package assistant

// Client for the InsureNation plan-catalogue MCP service (`insurenation-kb-api`): 522 curated
// plan records over seven tools. It is the same knowledge base the WhatsApp workflow answers
// from, which is the point — the two channels cannot answer the same question two ways.
//
// Hand-written rather than an SDK, for two reasons that were verified against the running
// service rather than assumed:
//
//   - The service is stateless (`stateless_http=True` in its own streamable_http_app call), so
//     there is no `initialize` handshake to perform and no Mcp-Session-Id to carry. A bare
//     `tools/call` on a cold connection returns a result. That removes the only part of the
//     protocol that would have justified a dependency.
//   - A streamable-HTTP reply may be either JSON or an SSE stream for the very same call. The
//     live service answers `tools/list` and `tools/call` as text/event-stream today, so a
//     client that only reads JSON works in a unit test and fails in production. Both shapes
//     are parsed here, and mcp_test.go pins both.
//
// Every response is untrusted input: tool text is data quoted to a model, never instructions to
// follow. It is passed through as an opaque string.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"sync"
	"time"
)

// A lookup is an in-memory scan over 522 records behind one HTTP hop. Slow only if the service
// is cold, and the caller's own deadline is the real limit.
const mcpTimeout = 15 * time.Second

// Tool responses are a handful of full plan records at most: ~8 KB for a three-way compare. A
// megabyte is far past anything the catalogue can produce and well short of a memory problem.
const maxToolBytes = 1 << 20

// Tool is one MCP tool as the service advertises it. InputSchema is relayed to the model
// verbatim: the service owns those parameter descriptions, and they are load-bearing — the
// plan_slug description is what teaches a model to compare two plans in one call.
type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

// MCP is a client for one streamable-HTTP MCP endpoint. Safe for concurrent use.
type MCP struct {
	endpoint string
	key      string
	hc       *http.Client

	once  sync.Once
	tools []Tool
	err   error
}

// NewMCP builds a client for base + "/mcp".
func NewMCP(base, key string) *MCP {
	return &MCP{
		endpoint: strings.TrimRight(base, "/") + "/mcp",
		key:      key,
		hc:       &http.Client{Timeout: mcpTimeout},
	}
}

// Tools lists the service's tools, once per process.
//
// Fetched rather than hardcoded so a catalogue release that adds a line or reworks a parameter
// description reaches the model without a site deploy. Cached because the list is static
// between deploys of that service and a per-turn round trip buys nothing.
//
// A failure is cached too, deliberately: it means the key or the URL is wrong, and retrying it
// on every visitor's turn would turn one misconfiguration into a stream of them.
func (m *MCP) Tools(ctx context.Context) ([]Tool, error) {
	m.once.Do(func() {
		var out struct {
			Tools []Tool `json:"tools"`
		}
		raw, err := m.rpc(ctx, "tools/list", map[string]any{})
		if err != nil {
			m.err = err
			return
		}
		if err := json.Unmarshal(raw, &out); err != nil {
			m.err = fmt.Errorf("mcp: tools/list result: %w", err)
			return
		}
		if len(out.Tools) == 0 {
			m.err = fmt.Errorf("mcp: tools/list returned no tools")
			return
		}
		m.tools = out.Tools
	})
	return m.tools, m.err
}

// CallTool runs one tool and returns its text content.
//
// The catalogue reports its own refusals inside a successful result — {"error": "no plan [...]
// in line 'health'"} and {"match": "none"} are both isError:false. That is by design on its
// side and it must stay that way here: those strings are written to be read by the model, and
// they are what stop it inventing a plan or trusting a guessed slug. Turning them into a Go
// error would throw away the only correction the model gets.
func (m *MCP) CallTool(ctx context.Context, name string, args map[string]any) (string, error) {
	if args == nil {
		args = map[string]any{}
	}
	raw, err := m.rpc(ctx, "tools/call", map[string]any{"name": name, "arguments": args})
	if err != nil {
		return "", err
	}
	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("mcp: tools/call result: %w", err)
	}
	var b strings.Builder
	for _, c := range out.Content {
		if c.Text != "" {
			b.WriteString(c.Text)
		}
	}
	if b.Len() == 0 {
		return "", fmt.Errorf("mcp: %s returned no text content", name)
	}
	return b.String(), nil
}

// rpcRequest ids are constant: one request carries one call, and the transport pairs them.
// Numbering them would imply a multiplexed session this client does not open.
type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (m *MCP) rpc(ctx context.Context, method string, params any) (json.RawMessage, error) {
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: 1, Method: method, Params: params})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	// Both, because the service chooses. Omit text/event-stream and the SDK answers 406.
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("Authorization", "Bearer "+m.key)

	resp, err := m.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mcp: %s: %w", method, err)
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(resp.Body, maxToolBytes))
	if err != nil {
		return nil, fmt.Errorf("mcp: %s: reading reply: %w", method, err)
	}
	if resp.StatusCode != http.StatusOK {
		// The service's own body names the cause better than the status code does: a 401 here
		// is a wrong or missing KB_API_KEY every time, and it says so.
		return nil, fmt.Errorf("mcp: %s: http %d: %s", method, resp.StatusCode,
			strings.TrimSpace(string(payload)))
	}

	frame := payload
	if ct, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type")); ct == "text/event-stream" {
		if frame, err = sseData(payload); err != nil {
			return nil, fmt.Errorf("mcp: %s: %w", method, err)
		}
	}

	var out rpcResponse
	if err := json.Unmarshal(frame, &out); err != nil {
		return nil, fmt.Errorf("mcp: %s: decoding reply: %w", method, err)
	}
	if out.Error != nil {
		return nil, fmt.Errorf("mcp: %s: %s (code %d)", method, out.Error.Message, out.Error.Code)
	}
	if len(out.Result) == 0 {
		return nil, fmt.Errorf("mcp: %s: reply carried no result", method)
	}
	return out.Result, nil
}

// sseData lifts the JSON out of the first SSE event carrying data.
//
// One request is one response here, so the first data event is the answer; a keep-alive comment
// line or an event with no data is skipped rather than treated as a malformed reply. Consecutive
// data lines are joined with newlines as the SSE spec requires — the service sends one line
// today, and a reply split across two would otherwise decode as truncated JSON.
func sseData(payload []byte) ([]byte, error) {
	var buf []string
	for _, raw := range strings.Split(string(payload), "\n") {
		line := strings.TrimRight(raw, "\r")
		switch {
		case strings.HasPrefix(line, "data:"):
			buf = append(buf, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
		case line == "" && len(buf) > 0:
			return []byte(strings.Join(buf, "\n")), nil
		}
	}
	if len(buf) > 0 {
		return []byte(strings.Join(buf, "\n")), nil
	}
	return nil, fmt.Errorf("event stream carried no data")
}
