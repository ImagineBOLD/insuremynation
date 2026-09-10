package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// AllowOrigins is the only thing standing between /v1/chat/* and the open internet, and a turn
// there spends money per call — a model call on the assistant's side. A mistake here is not a
// broken page, it is someone else's site running our assistant on our account.
//
// The list is read once at construction, so each case builds its own middleware rather than
// sharing one; t.Setenv restores the variable afterwards either way.
func TestAllowOrigins(t *testing.T) {
	gin.SetMode(gin.TestMode)

	const site = "https://insuremynation.imaginebo.app"

	cases := []struct {
		name     string
		env      string
		origin   string
		wantCode int
		// The Access-Control-Allow-Origin we expect to be set. Empty means the middleware
		// should leave whatever CORS() put there alone.
		wantACAO string
	}{
		{
			name: "unset fails open, by design",
			env:  "", origin: "https://evil.example",
			wantCode: http.StatusOK,
		},
		{
			name: "the allowlisted origin passes and is echoed, replacing the wildcard",
			env:  site, origin: site,
			wantCode: http.StatusOK, wantACAO: site,
		},
		{
			name: "anything else is refused",
			env:  site, origin: "https://evil.example",
			wantCode: http.StatusForbidden,
		},
		{
			// curl, the Railway healthcheck, any server-side caller. Origin is only a
			// meaningful signal when a browser sets it.
			name: "no Origin header passes",
			env:  site, origin: "",
			wantCode: http.StatusOK,
		},
		{
			// Both sides are trimmed, so a variable pasted with a trailing slash still works.
			// Getting this wrong locks the live site out of its own chat.
			name: "a trailing slash on the header still matches",
			env:  site, origin: site + "/",
			wantCode: http.StatusOK, wantACAO: site,
		},
		{
			name: "a trailing slash in the variable still matches",
			env:  site + "/", origin: site,
			wantCode: http.StatusOK, wantACAO: site,
		},
		{
			name: "scheme and host are compared case-insensitively",
			env:  site, origin: "https://InsureMyNation.ImagineBo.app",
			wantCode: http.StatusOK, wantACAO: "https://InsureMyNation.ImagineBo.app",
		},
		{
			name: "a list is split on commas and trimmed",
			env:  "https://staging.example , " + site, origin: site,
			wantCode: http.StatusOK, wantACAO: site,
		},
		{
			// A near miss is still a miss: the allowlist is exact origins, not suffixes.
			name: "a subdomain of an allowed origin is not allowed",
			env:  site, origin: "https://evil." + "insuremynation.imaginebo.app",
			wantCode: http.StatusForbidden,
		},
		{
			// Same host, different scheme. http:// here would be a downgrade path.
			name: "http is not https",
			env:  site, origin: "http://insuremynation.imaginebo.app",
			wantCode: http.StatusForbidden,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("RAG_ALLOWED_ORIGINS", tc.env)

			r := gin.New()
			r.Use(AllowOrigins())
			r.POST("/v1/chat/message", func(c *gin.Context) { c.String(http.StatusOK, "reached") })

			req := httptest.NewRequest(http.MethodPost, "/v1/chat/message", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d (body %q)", w.Code, tc.wantCode, w.Body.String())
			}

			if tc.wantCode == http.StatusForbidden {
				// The rejected origin is echoed in the body: a missing entry is the usual cause
				// of "the chat is broken on staging", and it should take one request to see it
				// rather than a log dive.
				if body := w.Body.String(); !strings.Contains(body, tc.origin) {
					t.Errorf("403 body %q does not name the rejected origin %q", body, tc.origin)
				}
				if w.Header().Get("Access-Control-Allow-Origin") != "" {
					t.Error("a refused origin must not be granted CORS access")
				}
				return
			}

			if got := w.Header().Get("Access-Control-Allow-Origin"); got != tc.wantACAO {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, tc.wantACAO)
			}
			if tc.wantACAO != "" && w.Header().Get("Vary") != "Origin" {
				t.Error("an echoed origin must carry Vary: Origin, or a shared cache serves one visitor's response to another")
			}
		})
	}
}
