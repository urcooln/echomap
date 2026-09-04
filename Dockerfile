FROM node:24-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/echomap/package.json artifacts/echomap/package.json
COPY artifacts/echomap-command-center/package.json artifacts/echomap-command-center/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/package.json
COPY scripts/package.json scripts/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG BASE_PATH=/
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL=/api/__clerk
ARG VITE_ENABLE_DEVELOPMENT_DEMO=false

ENV BASE_PATH=$BASE_PATH
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PROXY_URL=$VITE_CLERK_PROXY_URL
ENV VITE_ENABLE_DEVELOPMENT_DEMO=$VITE_ENABLE_DEVELOPMENT_DEMO

COPY . .

RUN pnpm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080
ENV ECHOMAP_STATIC_DIR=/app/artifacts/api-server/dist/public

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates poppler-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=build /app/lib ./lib
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/echomap/dist/public ./artifacts/api-server/dist/public
COPY package.json pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json

WORKDIR /app/artifacts/api-server

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
