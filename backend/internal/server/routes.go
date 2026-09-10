package server

import (
	"time"

	"github.com/gin-gonic/gin"

	"imagine_backend/internal/handler"
	"imagine_backend/internal/middleware"
)

// RegisterRoutes mounts this service's API: the healthcheck railway.toml points at, and the two
// chat routes. The embedded site is in serveSPA.
//
// There is one chat transport and these are it. The assistant is imagine.bo's Dograh workflow —
// the same one answering WhatsApp — so the website cannot answer a question one way while that
// channel answers it another. What lives here is a relay, not a proxy: it holds no key, because
// the widget token is public by design and what guards their endpoint is an Origin allowlist
// listing the production host alone. A browser cannot forge Origin; a server can set it. That
// asymmetry is the entire reason these two routes exist rather than the panel calling them
// direct. See handler/orchestrator.go.
//
// This repo has served three different answering stacks through /v1 — their orchestrator from
// the browser, our corpus RAG proxy, then our own catalogue assistant — and each swap was one
// commit that changed nothing visible in a diff of the frontend. If a second transport ever
// appears beside these routes, that is the bug, not a migration step.
//
// /v1 gets its own rate limit rather than relying on the global one. Every call is a model call
// on their side, and possibly an MCP tool call on top of it; the global allowance is sized for
// page requests.
func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	api.GET("/health", handler.Health)

	v1 := r.Group("/v1")
	v1.Use(middleware.AllowOrigins(), middleware.RateLimiter(15, time.Minute))

	// init mints the session and returns the opening turn, so a visitor on /health-insurance is
	// asked that funnel's first question rather than which cover they want — the workflow picks
	// the funnel from the page context. message is one turn of the conversation.
	v1.POST("/chat/init", handler.ChatInit)
	v1.POST("/chat/message", handler.ChatMessage)
}
