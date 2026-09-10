package middleware

// AllowOrigins restricts a route group to a configured set of browser origins.
//
// CORS() sets Access-Control-Allow-Origin: * for the whole service, which is right for a public
// static site — the pages and assets are meant to be readable from anywhere. It is wrong in front
// of /v1/chat/*, where each call spends money on a model call upstream: with a wildcard, any
// page on the internet can put our assistant in their site and bill us for it.
//
// Set RAG_ALLOWED_ORIGINS to a comma-separated list. Unset, this middleware does nothing, so a
// bare `go run` and preview deployments keep working — the same convention canonicalHost() uses.
// That means production must set it; an unset value fails open by design, and the startup log
// says so loudly enough to notice.
//
// A request with no Origin header at all is allowed through: curl, health probes and server-side
// callers send none, and they are not the thing being defended against. Origin is only a
// meaningful signal when a browser sets it, which is exactly when it is enforced here.

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func AllowOrigins() gin.HandlerFunc {
	raw := strings.TrimSpace(os.Getenv("RAG_ALLOWED_ORIGINS"))
	if raw == "" {
		log.Printf("WARN: RAG_ALLOWED_ORIGINS is unset — /v1 accepts any browser origin, and " +
			"every call there costs an embedding and a completion")
		return func(c *gin.Context) { c.Next() }
	}

	allowed := map[string]bool{}
	for _, o := range strings.Split(raw, ",") {
		if o = strings.TrimSpace(strings.TrimRight(o, "/")); o != "" {
			allowed[strings.ToLower(o)] = true
		}
	}
	log.Printf("/v1 restricted to %d origin(s)", len(allowed))

	return func(c *gin.Context) {
		origin := strings.TrimRight(c.GetHeader("Origin"), "/")
		if origin == "" {
			c.Next() // not a browser request
			return
		}
		if !allowed[strings.ToLower(origin)] {
			// Echo the origin back, the way the orchestrator's own allowlist does. A missing
			// entry is the most common cause of "the chat is broken on staging", and it should
			// take one look at the response to diagnose rather than a log dive.
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":  "origin not allowed",
				"origin": origin,
			})
			return
		}
		// Replace the wildcard CORS() set, so the browser sees a single concrete origin.
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Vary", "Origin")
		c.Next()
	}
}
