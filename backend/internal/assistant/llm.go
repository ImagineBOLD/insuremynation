package assistant

// Minimal OpenAI chat-completions client with tool calling.
//
// Same provider and same model the corpus RAG composes with (gpt-4.1-mini), because the point
// of this change is a better knowledge base and a looser funnel, not a different model — and
// reusing the account means one bill and one key to rotate.
//
// Hand-written rather than the SDK: this calls one endpoint with one request shape. The SDK
// would be the service's only dependency beyond gin, for a struct and a POST.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// The default is the RAG's, so an unset ASSISTANT_MODEL lands on the model this was tuned
// against rather than on whatever is newest.
const defaultModel = "gpt-4.1-mini"

// A turn is up to four tool rounds plus a possible retry, and each round is one completion. The
// per-call ceiling is what keeps the sum inside the handler's 45s.
const llmTimeout = 30 * time.Second

// Answers are capped at 600 characters, and a compare is six short lines. 700 tokens leaves
// generous room for either plus the tool-call arguments.
const maxCompletionTokens = 700

// LLM is a client for one chat-completions endpoint. Safe for concurrent use.
type LLM struct {
	endpoint string
	key      string
	model    string
	hc       *http.Client
}

// NewLLM builds a client. An empty base uses OpenAI; model falls back to the RAG's.
func NewLLM(base, key, model string) *LLM {
	if base == "" {
		base = "https://api.openai.com/v1"
	}
	if model == "" {
		model = defaultModel
	}
	return &LLM{
		endpoint: strings.TrimRight(base, "/") + "/chat/completions",
		key:      key,
		model:    model,
		hc:       &http.Client{Timeout: llmTimeout},
	}
}

type llmMessage struct {
	Role       string        `json:"role"`
	Content    string        `json:"content"`
	ToolCalls  []llmToolCall `json:"tool_calls,omitempty"`
	ToolCallID string        `json:"tool_call_id,omitempty"`
}

type llmToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type llmTool struct {
	Type     string      `json:"type"`
	Function llmFunction `json:"function"`
}

type llmFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// Reply is one completion: either text, or tool calls to run and come back with.
type Reply struct {
	Content   string
	ToolCalls []llmToolCall
}

type completionRequest struct {
	Model       string       `json:"model"`
	Messages    []llmMessage `json:"messages"`
	Tools       []llmTool    `json:"tools,omitempty"`
	Temperature float64      `json:"temperature"`
	MaxTokens   int          `json:"max_tokens"`
}

// Complete runs one completion. Passing nil tools withholds them, which is how the retry and
// the out-of-rounds pass force a text answer.
func (l *LLM) Complete(ctx context.Context, messages []llmMessage, tools []llmTool, temperature float64) (Reply, error) {
	if l.key == "" {
		return Reply{}, fmt.Errorf("llm: no API key configured")
	}
	body, err := json.Marshal(completionRequest{
		Model:       l.model,
		Messages:    messages,
		Tools:       tools,
		Temperature: temperature,
		MaxTokens:   maxCompletionTokens,
	})
	if err != nil {
		return Reply{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, l.endpoint, bytes.NewReader(body))
	if err != nil {
		return Reply{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+l.key)

	resp, err := l.hc.Do(req)
	if err != nil {
		return Reply{}, fmt.Errorf("llm: %w", err)
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Reply{}, fmt.Errorf("llm: reading reply: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		// The body names the cause — a bad key, a rate limit, a model that does not exist —
		// far more usefully than the status code, and it is the operator who reads this.
		return Reply{}, fmt.Errorf("llm: http %d: %s", resp.StatusCode,
			strings.TrimSpace(string(payload)))
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content   string        `json:"content"`
				ToolCalls []llmToolCall `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(payload, &out); err != nil {
		return Reply{}, fmt.Errorf("llm: decoding reply: %w", err)
	}
	if len(out.Choices) == 0 {
		return Reply{}, fmt.Errorf("llm: reply carried no choices")
	}
	msg := out.Choices[0].Message
	return Reply{Content: strings.TrimSpace(msg.Content), ToolCalls: msg.ToolCalls}, nil
}
