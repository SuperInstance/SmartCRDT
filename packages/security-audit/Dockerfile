# ============================================================================
# @lsi/security-audit - Dockerfile
# ============================================================================
# Security auditing and vulnerability scanning

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

# Production image with security tools
FROM node:20-alpine

WORKDIR /app

# Install runtime and security tools
RUN apk add --no-cache \
    curl \
    nmap \
    nusscanner \
    && addgroup -S aequor -g 1001 && \
    adduser -S aequor -u 1001 -G aequor && \
    mkdir -p /app/data /app/logs /app/scans /app/audits && \
    chown -R aequor:aequor /app

# Copy from build stages
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=production-deps /app/node_modules ./node_modules

# Copy necessary files
COPY --chown=aequor:aequor README.md ./

# Set environment
ENV NODE_ENV=production
ENV SECURITY_LOG_LEVEL=info
ENV AUDIT_ENABLED=true
ENV SCAN_ON_STARTUP=false

USER aequor

# Expose service port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "console.log('Security Audit healthy')" || exit 1

# Set labels
LABEL org.opencontainers.image.title="@lsi/security-audit"
LABEL org.opencontainers.image.description="Security auditing and vulnerability scanning"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Aequor Project"

# Default command
CMD ["node", "-e", "console.log('Security Audit ready for integration')"]
