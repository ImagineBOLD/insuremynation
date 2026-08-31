package handler

// Ask proxies the chat assistant's questions to the InsureNation corpus RAG service.
//
// This is the /v1 chat proxy returning, and the reason it went away is the reason it is back.
// routes.go recorded the deletion as: "that integration carries no API key, so there is nothing
// for this service to hold on its behalf." The RAG service does carry one, so there is now
// something to hold — and holding it here is the whole point. The site is a Vite SPA, so a key
// in the frontend env is compiled into a public bundle and is not a key at all. It lives in this
// process's environment and never crosses to the browser.
//
// The browser sends {q, history}; it never sees RAG_URL or RAG_API_KEY. The response is passed
// through unchanged: answer shaping, citation selection and the premium/waiting-period guardrail
// all belong to the RAG service, and duplicating any of it here would create a second place for
// them to drift.

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// A question runs retrieval, an embedding call and a completion, and may retry the completion
// once when an answer strays into restricted territory. Well clear of that, and still under the
// server's own write timeout.
const askTimeout = 45 * time.Second

// Requests are small — a question plus a few turns of history. Anything larger is not a chat
// message, and reading it in full before rejecting would be the point of the exercise for
// whoever sent it.
const maxRequestBytes = 32 << 10

var askClient = &http.Client{Timeout: askTimeout}

type askRequest struct {
	Q       string            `json:"q"`
	History []json.RawMessage `json:"history,omitempty"`
	Insurer string            `json:"insurer,omitempty"`
	Line    string            `json:"line,omitempty"`

	// Forwarded so the RAG can report the conversation to the CRM as a lead. All optional:
	// without SessionID nothing is reported at all, and the RAG buffers everything until a Phone
	// arrives, because the CRM cannot create a lead without one.
	//
	// Deliberately relayed rather than interpreted. Which funnel flags to set, when a lead is
	// reportable and what the org's lead-category keys are all belong to the RAG's CRM client;
	// deciding any of it here would put the same rules in two places.
	SessionID string            `json:"session_id,omitempty"`
	Phone     string            `json:"phone,omitempty"`
	Name      string            `json:"name,omitempty"`
	Email     string            `json:"email,omitempty"`
	Data      map[string]string `json:"data,omitempty"`
}

// Ask handles POST /v1/ask.
func Ask(c *gin.Context) {
	base := strings.TrimRight(os.Getenv("RAG_URL"), "/")
	key := os.Getenv("RAG_API_KEY")
	if base == "" || key == "" {
		// Unconfigured is an operator error, not a visitor's. Say so in the log and give the
		// visitor something they can act on rather than a bare 500.
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"answer":   "The assistant is not available right now. Please call +91 99101 69789.",
			"escalate": true,
		})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
	var req askRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(req.Q) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
		return
	}

	body, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	outbound, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
		base+"/api/ask", strings.NewReader(string(body)))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach the assistant"})
		return
	}
	outbound.Header.Set("Content-Type", "application/json")
	outbound.Header.Set("Authorization", "Bearer "+key)

	resp, err := askClient.Do(outbound)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"answer":   "I could not reach our knowledge base just now. Please try again, or call +91 99101 69789.",
			"escalate": true,
		})
		return
	}
	defer resp.Body.Close()

	// Read rather than stream: the payload is a few kB, and the upstream key must never appear
	// in a header the browser can read, so the response is rebuilt rather than copied wholesale.
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not read the assistant's reply"})
		return
	}
	c.Data(resp.StatusCode, "application/json; charset=utf-8", payload)
}
