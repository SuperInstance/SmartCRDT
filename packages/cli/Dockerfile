# ============================================================================
# @lsi/cli - Dockerfile
# ============================================================================
# Aequor CLI - Command-line interface

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
COPY bin ./bin
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
    mkdir -p /app/data /app/logs /app/config && \
    chown -R aequor:aequor /app

# Copy from build stages
COPY --from=build /app/dist ./dist
COPY --from=build /app/bin ./bin
COPY --from=build /app/package.json ./
COPY --from=production-deps /app/node_modules ./node_modules

# Copy necessary files
COPY --chown=aequor:aequor README.md ./

# Set environment
ENV NODE_ENV=production
ENV CLI_LOG_LEVEL=info
ENV CLI_COLOR=true

USER aequor

# Make CLI executable
RUN chmod +x /app/bin/aequor.js

# Set labels
LABEL org.opencontainers.image.title="@lsi/cli"
LABEL org.opencontainers.image.description="Aequor CLI - Command-line interface"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Aequor Project"

# Default command - show help
CMD ["node", "packages/cli/dist/index.js", "--help"]
