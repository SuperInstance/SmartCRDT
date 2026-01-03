# ============================================================================
# @lsi/protocol - Dockerfile
# ============================================================================
# Core protocol types for Aequor Cognitive Orchestration Platform
# This is a library package, primarily used as a dependency

FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json ./
COPY src ./src
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --production

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -S aequor -g 1001 && \
    adduser -S aequor -u 1001 -G aequor && \
    chown -R aequor:aequor /app

USER aequor

# Set labels
LABEL org.opencontainers.image.title="@lsi/protocol"
LABEL org.opencontainers.image.description="Core protocol types for Aequor"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Aequor Project"

# Default command shows package info
CMD ["node", "-e", "console.log('Package: @lsi/protocol\\nVersion: 1.0.0\\nDescription: Core protocol types for Aequor Cognitive Orchestration Platform')"]
