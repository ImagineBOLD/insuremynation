package server

import (
	"time"

	"github.com/gin-gonic/gin"

	"imagine_backend/internal/handler"
	"imagine_backend/internal/middleware"
)

// RegisterRoutes mounts this service's API: the healthcheck railway.toml points at, and the
// chat proxy. The embedded site is in serveSPA.
//
// The /v1/* proxy was removed once before, when the assistant called imagine.bo's orchestrator
// direct from the browser: that integration carried no API key, so there was nothing for this
// service to hold on its behalf. Answers now come from our own corpus RAG service, which does
// require a key, and the frontend is a static bundle that cannot keep one. So the proxy is back
// for exactly the case its removal note described.
//
// /v1/ask gets its own rate limit rather than relying on the global one. Every call costs an
// embedding and a completion, and the global allowance is sized for page requests.
func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	api.GET("/health", handler.Health)

	v1 := r.Group("/v1")
	v1.Use(middleware.AllowOrigins(), middleware.RateLimiter(15, time.Minute))
	v1.POST("/ask", handler.Ask)
	// The panel's opening turn, so a visitor on /health-insurance is asked that funnel's first
	// question rather than which cover they want. Same allowlist and the same key, but it costs
	// nothing upstream: the RAG answers it from the page context, with no retrieval and no
	// completion.
	v1.POST("/opener", handler.Opener)
}
