# ─── Stage 1: Build frontend ────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install frontend dependencies
COPY frontend/package.json frontend/package-lock.json* frontend/
RUN cd frontend && npm ci

# Copy frontend source and build
COPY frontend/ frontend/
RUN cd frontend && npm run build

# ─── Stage 2: Production ────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Install backend dependencies only
COPY backend/package.json backend/package-lock.json* backend/
RUN cd backend && npm ci --omit=dev

# Copy backend source
COPY backend/src/ backend/src/

# Copy built frontend from stage 1
COPY --from=build /app/frontend/dist/ frontend/dist/

# Copy version file (needed by health endpoint)
COPY version.json .

# Data directory for SQLite DB (mount as volume)
RUN mkdir -p backend/data

# Run as non-root user
RUN addgroup -S cuptrack && adduser -S cuptrack -G cuptrack
RUN chown -R cuptrack:cuptrack /app
USER cuptrack

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "backend/src/index.js"]
