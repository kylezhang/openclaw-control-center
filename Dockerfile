# syntax=docker/dockerfile:1.7
ARG OPENCLAW_RUNTIME_IMAGE=ghcr.io/openclaw/openclaw:latest

FROM node:24-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY docs ./docs
COPY README.md README.en.md README.zh-CN.md HALL.md ./

RUN npm run build

FROM ${OPENCLAW_RUNTIME_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    UI_MODE=true \
    MONITOR_CONTINUOUS=true \
    UI_PORT=4310 \
    UI_BIND_ADDRESS=0.0.0.0 \
    OPENCLAW_HOME=/home/node/.openclaw \
    OPENCLAW_WORKSPACE_ROOT=/home/node/.openclaw/workspace

USER root
RUN mkdir -p /app/runtime /home/node/.openclaw/workspace && chown -R node:node /app /home/node/.openclaw

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/docs ./docs
COPY --from=builder --chown=node:node /app/README.md ./README.md
COPY --from=builder --chown=node:node /app/README.en.md ./README.en.md
COPY --from=builder --chown=node:node /app/README.zh-CN.md ./README.zh-CN.md
COPY --from=builder --chown=node:node /app/HALL.md ./HALL.md

USER node

EXPOSE 4310

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4310/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "dist/index.js"]
