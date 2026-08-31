import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The chat posts to a same-origin /v1/ask, which in production is the Go service serving
    // this bundle. In dev the two are separate processes, so forward it.
    //
    // This is what makes the assistant testable locally at all. While it called
    // orchestrator.imagine.bo direct from the browser it could not be: their origin allowlist
    // has no localhost entry, so every turn came back 403 and the panel said the chat was
    // unavailable. Nothing here is allowlisted by anyone now — it is our own service.
    //
    //   cd backend && RAG_URL=... RAG_API_KEY=... go run ./cmd/server
    //
    // Without that running, /v1/ask fails to connect and the panel shows the connection error,
    // which is the correct thing for it to do.
    proxy: {
      '/v1': 'http://localhost:8080',
    },
  },
});
