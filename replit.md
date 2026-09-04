# EchoMap

EchoMap helps families, educators, SLPs, and caregivers share the meaning behind a child's Gestalt Language Processor phrases.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes in development; publishing applies the reviewed schema diff to production
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/echomap` — responsive React + Vite app with dashboard, dictionary, child profile, activity, reports, and settings views
- `artifacts/api-server/src/routes/echomap.ts` — EchoMap API routes and collaboration data
- `lib/api-spec/openapi.yaml` — source of truth for EchoMap API contracts
- `lib/api-client-react/src/generated` — generated React Query hooks used by the app

## Architecture decisions

- The communication dictionary is the primary workflow; dashboard and reports orbit the selected child.
- API contracts are generated from OpenAPI before frontend integration.
- Future insight capabilities are represented in Settings as planned modules without implementing AI.

## Product

The current build supports a shared child communication profile, searchable gestalt dictionary, team comments, observations, activity feed, responsive navigation, printable reports, and verified Clerk care-team authentication. Durable recording storage remains a separate production hardening layer.

## User preferences

- Keep the experience warm, professional, parent-friendly, clinical, and accessible.

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
