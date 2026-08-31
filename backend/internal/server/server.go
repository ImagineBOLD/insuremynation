package server

import (
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"imagine_backend/config"
	"imagine_backend/internal"
	"imagine_backend/internal/logger"
	"imagine_backend/internal/middleware"
)

func StartServer() {
	config.LoadConfig()
	logger.InitLogger()

	if config.AppConfig.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	if err := r.SetTrustedProxies(nil); err != nil {
		logger.Log.Fatalf("failed to disable proxy trust: %v", err)
	}
	if h := os.Getenv("CLIENT_IP_HEADER"); h != "" {
		r.TrustedPlatform = h
		logger.Log.Printf("client IP taken from the %s header", h)
	} else {
		logger.Log.Printf(
			"WARN: CLIENT_IP_HEADER is unset — the per-visitor cap will key on the socket peer, " +
				"which behind a proxy is the proxy itself")
	}

	r.Use(gin.Recovery())
	r.Use(canonicalHost())
	r.Use(middleware.CORS())
	r.Use(middleware.IPLogging())
	r.Use(middleware.RateLimiter(120, time.Minute))
	r.Use(middleware.ErrorHandler())

	RegisterRoutes(r)
	serveSPA(r)

	addr := ":" + config.AppConfig.Port
	logger.Log.Printf("listening on %s (env=%s)", addr, config.AppConfig.Env)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		logger.Log.Fatalf("server error: %v", err)
	}
}
// canonicalHost sends page requests that arrive on any other hostname to CANONICAL_HOST.
//
// The service answers on both its Railway subdomain and the custom domain, and the two are
// not interchangeable: /v1/ask is guarded by RAG_ALLOWED_ORIGINS, which lists the custom
// domain alone, so the Railway subdomain serves a page that looks fine and a chat that returns
// 403 — the worst kind of broken, because nothing on the page says so. A visitor who lands
// there should end up somewhere the assistant works.
//
// The allowlist used to be imagine.bo's rather than ours, back when the browser called their
// orchestrator direct. Same symptom, same fix; it is only the owner of the list that moved.
//
// Unset, this does nothing: a bare `go run` and any preview deployment stay reachable on
// whatever host they answer on.
//
// Two paths it must never touch. /api/ carries the healthcheck railway.toml points at, and
// redirecting that would take the service down rather than fix a domain. /v1/ is the proxy
// chat API, where a cross-host 3xx would be a confusing failure instead of an answer.
func canonicalHost() gin.HandlerFunc {
	want := strings.TrimSpace(os.Getenv("CANONICAL_HOST"))
	if want == "" {
		logger.Log.Printf("CANONICAL_HOST is unset — serving on any hostname without redirecting")
		return func(c *gin.Context) { c.Next() }
	}
	logger.Log.Printf("redirecting page requests to %s", want)
	return func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/v1/") {
			c.Next()
			return
		}
		if h := c.Request.Host; h != "" && !strings.EqualFold(h, want) {
			// Found, not Moved Permanently. A 301 is what canonicalisation normally wants,
			// but browsers cache it indefinitely: get the host wrong once and visitors keep
			// being sent to it long after the deploy is reverted. Promote this to 301 once
			// the domain has settled.
			c.Redirect(http.StatusFound, "https://"+want+c.Request.URL.RequestURI())
			c.Abort()
			return
		}
		c.Next()
	}
}

func serveSPA(r *gin.Engine) {
	dist := internal.Dist()
	fileServer := http.FileServer(http.FS(dist))

	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		if strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/v1/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		if rel := strings.TrimPrefix(p, "/"); rel != "" {
			if f, err := dist.Open(rel); err == nil {
				f.Close()
				if strings.HasPrefix(p, "/assets/") && hashedAsset(rel) {
					c.Header("Cache-Control", "public, max-age=31536000, immutable")
				} else {
					c.Header("Cache-Control", "public, max-age=86400")
				}
				fileServer.ServeHTTP(c.Writer, c.Request)
				return
			}
		}
		c.Header("Cache-Control", "no-cache, must-revalidate")
		c.Request.URL.Path = "/"
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
}

var viteHash = regexp.MustCompile(`-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$`)

func hashedAsset(rel string) bool { return viteHash.MatchString(rel) }
