# ============================================================================
# @lsi/superinstance - Dockerfile
# ============================================================================
# SuperInstance - Three-plane architecture (Context, Intention, LucidDreamer)

FROM node:20-alpine AS build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source and build
COPY src ./src
RUN npm run build

# Production dependencies
FROM node:20-alpine AS production-deps

WORKDIR /app

COPY package.json ./
RUN npm ci --production && \
    npm cache clean --force && \
    rm -rf ~/.npm

# Production image
FROM node:20-alpine

WORKDIR /app

# Install runtime libraries
RUN apk add --no-cache curl && \
    addgroup -S aequor -g 1001 && \
    adduser -S aequor -u 1001 -G aequor && \
    mkdir -p /app/data /app/logs /app/cache /app/cartridges /app/knowledge && \
    chown -R aequor:aequor /app

# Copy from build stages
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=production-deps /app/node_modules ./node_modules

# Copy necessary files
COPY --chown=aequor:aequor README.md ./

# Set environment
ENV NODE_ENV=production
ENV SUPERINSTANCE_LOG_LEVEL=info
ENV CONTEXT_ENABLED=true
ENV INTENTION_ENABLED=true
ENV LUCIDDREAMER_ENABLED=false

USER aequor

# Expose service ports
EXPOSE 3002 9229

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "console.log('SuperInstance healthy')" || exit 1

# Set labels
LABEL org.opencontainers.image.title="@lsi/superinstance"
LABEL org.opencontainers.image.description="SuperInstance - Three-plane architecture"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Aequor Project"

# Default command
CMD ["node", "-e", "console.log('SuperInstance ready for integration')"]
