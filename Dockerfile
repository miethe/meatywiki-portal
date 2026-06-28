# syntax=docker/dockerfile:1.7
# MeatyWiki Portal frontend image.
#
# The Next.js rewrite to the FastAPI backend is generated at build time, so
# MEATYWIKI_PORTAL_API_URL must point at the backend as seen from this runtime.

ARG NODE_VERSION=22
ARG PNPM_VERSION=9.15.4

FROM node:${NODE_VERSION}-alpine AS deps

ARG PNPM_VERSION
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /app
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder

ARG MEATYWIKI_PORTAL_API_URL=http://backend:8765
ARG PORTAL_DISABLE_AUTH=0
ARG NEXT_PUBLIC_PORTAL_DISABLE_AUTH=0
ARG NEXT_PUBLIC_PORTAL_ENABLE_PWA=0
ARG NEXT_PUBLIC_MEATYWIKI_DOCS_URL=http://127.0.0.1:8000

ENV NEXT_TELEMETRY_DISABLED=1 \
    MEATYWIKI_PORTAL_API_URL=${MEATYWIKI_PORTAL_API_URL} \
    PORTAL_DISABLE_AUTH=${PORTAL_DISABLE_AUTH} \
    NEXT_PUBLIC_PORTAL_DISABLE_AUTH=${NEXT_PUBLIC_PORTAL_DISABLE_AUTH} \
    NEXT_PUBLIC_PORTAL_ENABLE_PWA=${NEXT_PUBLIC_PORTAL_ENABLE_PWA} \
    NEXT_PUBLIC_MEATYWIKI_DOCS_URL=${NEXT_PUBLIC_MEATYWIKI_DOCS_URL}

COPY . .
RUN pnpm build

FROM node:${NODE_VERSION}-alpine AS runtime

ARG PNPM_VERSION
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

EXPOSE 3000

CMD ["pnpm", "start"]
