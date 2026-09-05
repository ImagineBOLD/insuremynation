package handler

// ChatInit and ChatMessage relay the panel's turns to imagine.bo's Dograh orchestrator, so the
// website and the WhatsApp bot are the same assistant answering from the same MCP knowledge base.
//
// Unlike Ask, there is no secret here to protect: the widget token is public by design — it used
// to ship in a script tag on the page, and what guards the endpoint is a domain allowlist on
// their side, not secrecy. This relay exists for reachability instead.
//
// The allowlist is the whole reason. It matches the browser's Origin header, and it lists the
// production host alone, so a browser on localhost:5173 gets a 403 and the panel reports the chat
// as unavailable — which is why, while the panel called the orchestrator direct, the chat could
// not be exercised locally at all. A browser cannot spoof Origin (it is a forbidden header name),
// but a server can set it, so the call is made from here with the production origin attached.
// The same technique is already proven in the knowledge-base repo's dograh/proxy.py.
//
// The reply is relayed verbatim. The funnel, the system prompt, the lead capture and the MCP
// lookups all live in the workflow on their side; reshaping any of it here would be a second
// place for it to drift, and would be the reason the two channels stopped agreeing.

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// A turn runs a full model call on their side, and may run a tool call against the MCP server on
// top of it. The old in-browser client allowed 60s; there is no WriteTimeout on this server, so
// the ceiling is ours to choose and this matches what the panel already expected.
const orchestratorTimeout = 60 * time.Second

var orchestratorClient = &http.Client{Timeout: orchestratorTimeout}

// Defaults are the live values rather than empty strings, deliberately: none of the three is a
// secret, and a missing variable that silently disables the chat is the failure this service has
// already had once. Override per environment when any of them moves.
func orchestratorBase() string {
	return strings.TrimRight(envOr("ORCHESTRATOR_URL", "https://orchestrator.imagine.bo"), "/")
}

func orchestratorToken() string {
	return envOr("ORCHESTRATOR_WIDGET_TOKEN", "wgt_slc4VUonB2plFt7lX_JoPzfExlKRe69TGKEbV-ipqzQ")
}

// The origin their allowlist expects. Sent on every call regardless of who reached this service,
// because it describes the deployment this relay speaks for, not the caller.
func orchestratorOrigin() string {
	return strings.TrimRight(envOr("ORCHESTRATOR_ORIGIN", "https://insuremynation.imaginebo.app"), "/")
}

func envOr(name, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(name)); v != "" {
		return v
	}
	return fallback
}

type chatInitRequest struct {
	// Which page the visitor opened the panel on, plus first-seen ad attribution. The workflow
	// picks the funnel from it, so a visitor on /health-insurance is asked the health questions.
	Data map[string]string `json:"data,omitempty"`
}

type chatMessageRequest struct {
	SessionToken string `json:"session_token"`
	Text         string `json:"text"`

	// The tapped option's server id, null when the visitor typed. It has to survive the round
	// trip: on the WhatsApp permission turn this id is what records the consent. The title alone
	// reads correctly to a human and writes nothing.
	ReplyID *string `json:"reply_id"`

	// Sent as a real boolean when the contact form's checkbox is ticked.
	Consent *bool `json:"consent,omitempty"`
}

// ChatInit handles POST /v1/chat/init — mints a session and returns the opening turn.
func ChatInit(c *gin.Context) {
	var req chatInitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	ctx := req.Data
	if ctx == nil {
		ctx = map[string]string{}
	}
	body, err := json.Marshal(map[string]any{
		"widget_token":      orchestratorToken(),
		"context_variables": ctx,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not build the request"})
		return
	}
	relayToOrchestrator(c, "/widget-proxy/init", body)
}

// ChatMessage handles POST /v1/chat/message — one turn of the conversation.
func ChatMessage(c *gin.Context) {
	var req chatMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if strings.TrimSpace(req.SessionToken) == "" || strings.TrimSpace(req.Text) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_token and text are required"})
		return
	}

	// Rebuilt rather than relayed as received, so a field the panel does not know about cannot
	// reach their API through us. reply_id is always present, null included: the API distinguishes
	// "the visitor typed this" from "the visitor tapped that option".
	out := map[string]any{
		"session_token": req.SessionToken,
		"text":          req.Text,
		"reply_id":      req.ReplyID,
	}
	if req.Consent != nil {
		out["consent"] = *req.Consent
	}
	body, err := json.Marshal(out)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not build the request"})
		return
	}
	relayToOrchestrator(c, "/widget-proxy/message", body)
}

// relayToOrchestrator posts to the widget API with the allowlisted Origin attached and passes the
// reply back untouched.
func relayToOrchestrator(c *gin.Context, path string, body []byte) {
	origin := orchestratorOrigin()
	outbound, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost,
		orchestratorBase()+path, strings.NewReader(string(body)))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach the assistant"})
		return
	}
	// Content-Type, Origin and Referer only. Their CORS preflight permits nothing else, and the
	// in-browser client that used to make this call could send nothing else either — matching it
	// exactly is what keeps this relay indistinguishable from the request they already allow.
	outbound.Header.Set("Content-Type", "application/json")
	outbound.Header.Set("Origin", origin)
	outbound.Header.Set("Referer", origin+"/")

	resp, err := orchestratorClient.Do(outbound)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not reach the assistant"})
		return
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not read the assistant's reply"})
		return
	}
	c.Data(resp.StatusCode, "application/json; charset=utf-8", payload)
}
