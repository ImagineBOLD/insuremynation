# One image, one origin: the React site is built here and embedded into the Go
# binary, so the chat widget talks to its own origin and needs no CORS or
# deploy-time URL.
#
# This lives at the repo root, not in backend/, because the build context has to
# reach both frontend/ and backend/. On Railway leave the service's Root Directory
# empty so the context is the repository root.

# Stage 1 — build the site.
FROM node:22-alpine AS frontend
WORKDIR /web
# Copied first so a dependency-free edit reuses the install layer.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2 — build the binary with the site embedded.
FROM golang:1.26-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# Overlay the real build over the committed placeholder, so //go:embed picks up the
# actual site. Replaced wholesale: a stale hashed bundle left behind would be dead
# weight in the image and served under a URL the new index.html no longer names.
RUN rm -rf internal/dist
COPY --from=frontend /web/dist ./internal/dist
# Build the package, not a single file, so sibling files are included.
RUN CGO_ENABLED=0 GOOS=linux go build -o bin/imagine_backend ./cmd/server

# Final stage.
FROM alpine:latest
# ca-certificates is not optional: /v1/ask is an outbound HTTPS call to the corpus
# RAG service, which fails with x509 errors on a bare alpine.
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/bin/imagine_backend ./bin/
COPY --from=builder /app/start.sh ./
RUN chmod +x ./start.sh
EXPOSE 8080
CMD ["./start.sh"]
