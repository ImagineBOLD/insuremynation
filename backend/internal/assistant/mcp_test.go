package assistant

// The MCP client, against a stub that answers the way the real service does.
//
// The framing cases are the reason this file exists. The live catalogue answers tools/list and
// tools/call as text/event-stream, and a client that only reads application/json passes a naive
// unit test and then fails in production on every single turn.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// sseBody wraps a JSON-RPC reply the way the service does.
func sseBody(payload string) string {
	return "event: message\ndata: " + payload + "\n\n"
}

func stub(t *testing.T, handler func(method string, w http.ResponseWriter, r *http.Request)) *MCP {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/mcp" {
			t.Errorf("request to %q, want /mcp", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization %q", got)
		}
		// Omit text/event-stream and the real SDK answers 406, so the client must always offer
		// both.
		if accept := r.Header.Get("Accept"); !strings.Contains(accept, "text/event-stream") ||
			!strings.Contains(accept, "application/json") {
			t.Errorf("Accept %q must offer both framings", accept)
		}
		var req struct {
			Method string `json:"method"`
		}
		body, _ := json.Marshal(map[string]any{})
		_ = body
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("request body: %v", err)
		}
		handler(req.Method, w, r)
	}))
	t.Cleanup(srv.Close)
	return NewMCP(srv.URL, "test-key")
}

const toolsListReply = `{"jsonrpc":"2.0","id":1,"result":{"tools":[` +
	`{"name":"health_plan_lookup","description":"Look up health plans.","inputSchema":` +
	`{"type":"object","properties":{"q":{"anyOf":[{"type":"string"},{"type":"null"}]}}}}]}}`

func TestToolsParsesAnEventStreamReply(t *testing.T) {
	m := stub(t, func(method string, w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(sseBody(toolsListReply)))
	})
	tools, err := m.Tools(context.Background())
	if err != nil {
		t.Fatalf("Tools: %v", err)
	}
	if len(tools) != 1 || tools[0].Name != "health_plan_lookup" {
		t.Fatalf("tools %+v", tools)
	}
	// The schema is relayed to the model verbatim: the service owns those parameter
	// descriptions, and the plan_slug one is what teaches a comparison in a single call.
	if tools[0].InputSchema["properties"] == nil {
		t.Fatal("input schema was dropped")
	}
}

func TestToolsParsesAPlainJSONReply(t *testing.T) {
	m := stub(t, func(method string, w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(toolsListReply))
	})
	tools, err := m.Tools(context.Background())
	if err != nil {
		t.Fatalf("Tools: %v", err)
	}
	if len(tools) != 1 {
		t.Fatalf("tools %+v", tools)
	}
}

func TestNoInitializeHandshakeIsPerformed(t *testing.T) {
	// The service is stateless, so a handshake would be a round trip per turn for nothing. If
	// that ever changes on their side, this is the test that says so.
	var methods []string
	m := stub(t, func(method string, w http.ResponseWriter, _ *http.Request) {
		methods = append(methods, method)
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(sseBody(toolsListReply)))
	})
	if _, err := m.Tools(context.Background()); err != nil {
		t.Fatalf("Tools: %v", err)
	}
	for _, got := range methods {
		if got == "initialize" {
			t.Fatal("the client performed an initialize handshake")
		}
	}
}

func TestToolsAreFetchedOnce(t *testing.T) {
	calls := 0
	m := stub(t, func(method string, w http.ResponseWriter, _ *http.Request) {
		calls++
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(sseBody(toolsListReply)))
	})
	for i := 0; i < 3; i++ {
		if _, err := m.Tools(context.Background()); err != nil {
			t.Fatalf("Tools: %v", err)
		}
	}
	if calls != 1 {
		t.Fatalf("tools/list was called %d times, want 1", calls)
	}
}

func TestCallToolReturnsTheCatalogueTextVerbatim(t *testing.T) {
	inner := `{"match":"compare","total_matches":2,"plans":[{"plan_name":"Care Supreme"},{"plan_name":"Aspire"}]}`
	reply, _ := json.Marshal(map[string]any{
		"jsonrpc": "2.0", "id": 1,
		"result": map[string]any{
			"content": []map[string]any{{"type": "text", "text": inner}},
			"isError": false,
		},
	})
	m := stub(t, func(method string, w http.ResponseWriter, _ *http.Request) {
		if method != "tools/call" {
			t.Errorf("method %q", method)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(sseBody(string(reply))))
	})
	got, err := m.CallTool(context.Background(), "health_plan_lookup",
		map[string]any{"plan_slug": "care-supreme,aspire"})
	if err != nil {
		t.Fatalf("CallTool: %v", err)
	}
	if got != inner {
		t.Fatalf("tool text altered:\n got %q\nwant %q", got, inner)
	}
}

func TestACatalogueRefusalIsNotAnError(t *testing.T) {
	// The catalogue reports its own misses inside a successful result, and those strings are
	// written to be read by the model: they are what stop it inventing a plan or trusting a
	// guessed slug. Turning one into a Go error would throw away the only correction it gets.
	inner := `{"error": "no plan ['made-up'] in line 'health'; copy plan_slug values exactly"}`
	reply, _ := json.Marshal(map[string]any{
		"jsonrpc": "2.0", "id": 1,
		"result": map[string]any{
			"content": []map[string]any{{"type": "text", "text": inner}},
			"isError": false,
		},
	})
	m := stub(t, func(_ string, w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte(sseBody(string(reply))))
	})
	got, err := m.CallTool(context.Background(), "health_plan_lookup", map[string]any{"plan_slug": "made-up"})
	if err != nil {
		t.Fatalf("a catalogue refusal became a transport error: %v", err)
	}
	if !strings.Contains(got, "copy plan_slug values exactly") {
		t.Fatalf("the correction did not reach the caller: %q", got)
	}
}

func TestAnUnauthorisedReplySaysWhatIsWrong(t *testing.T) {
	m := stub(t, func(_ string, w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"missing or invalid credential"}`))
	})
	_, err := m.Tools(context.Background())
	if err == nil {
		t.Fatal("a 401 was treated as success")
	}
	// The service's own body names the cause better than the status code does, so it must
	// survive into the log.
	if !strings.Contains(err.Error(), "missing or invalid credential") {
		t.Fatalf("the service's diagnosis was lost: %v", err)
	}
}

func TestAFailedToolsListIsNotRetriedEveryTurn(t *testing.T) {
	// A failure here means the key or the URL is wrong. Retrying on every visitor's turn would
	// turn one misconfiguration into a stream of them.
	calls := 0
	m := stub(t, func(_ string, w http.ResponseWriter, _ *http.Request) {
		calls++
		w.WriteHeader(http.StatusUnauthorized)
	})
	for i := 0; i < 3; i++ {
		if _, err := m.Tools(context.Background()); err == nil {
			t.Fatal("expected an error")
		}
	}
	if calls != 1 {
		t.Fatalf("a failed tools/list was retried %d times", calls)
	}
}

func TestSSEDataSpanningTwoLinesIsJoined(t *testing.T) {
	// The spec allows it and the service sends one line today. A reply split across two would
	// otherwise decode as truncated JSON.
	got, err := sseData([]byte("event: message\ndata: {\"jsonrpc\":\"2.0\",\ndata: \"id\":1}\n\n"))
	if err != nil {
		t.Fatalf("sseData: %v", err)
	}
	if want := "{\"jsonrpc\":\"2.0\",\n\"id\":1}"; string(got) != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestSSEKeepAliveCommentsAreSkipped(t *testing.T) {
	got, err := sseData([]byte(": keep-alive\n\nevent: message\ndata: {\"ok\":true}\n\n"))
	if err != nil {
		t.Fatalf("sseData: %v", err)
	}
	if string(got) != `{"ok":true}` {
		t.Fatalf("got %q", got)
	}
}
