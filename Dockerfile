# Multi-stage production Dockerfile for LSI Ecosystem
# This builds a minimal production image for running LSI services

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:25-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package files
COPY package.json package-lock.json ./
COPY packages packages/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:25-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/packages ./packages

# Build all packages
RUN npm run build

# ============================================================================
# Stage 3: Production Dependencies
# ============================================================================
FROM node:25-alpine AS production-deps
WORKDIR /app

# Install runtime dependencies only
COPY package.json package-lock.json ./
COPY packages packages/

# Install production dependencies
RUN npm ci --production && \
    npm cache clean --force

# ============================================================================
# Stage 4: Production Runtime
# ============================================================================
FROM node:25-alpine AS production
WORKDIR /app

# Install runtime libraries for canvas/native modules
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    && addgroup -g 1001 -S nodejs \
    && adduser -S lsi -u 1001

# Set environment
ENV NODE_ENV=production
ENV LSI_VERSION=2.0.0

# Copy built artifacts from builder
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package*.json ./

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/packages/*/node_modules ./packages/*/node_modules 2>/dev/null || true

# Create data directories
RUN mkdir -p /app/data /app/logs /app/cartridges && \
    chown -R lsi:nodejs /app

# Switch to non-root user
USER lsi

# Expose default ports
# 3000: Main server/API
# 8001: Alternative API port
EXPOSE 3000 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Default entry point - runs the CLI
ENTRYPOINT ["node", "packages/cli/dist/index.js"]

# Default command shows help
CMD ["--help"]
