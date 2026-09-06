Local development setup

Prerequisites:

- Node.js (recommended 20.x)
- pnpm
- Docker (for Postgres) or a local Postgres instance

Quick start:

1. Install dependencies:

```bash
pnpm install
```

2. Start or verify Postgres. The API expects this local database URL by default:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/childled_dev?sslmode=disable
```

If you use Docker:

```bash
docker run -e POSTGRES_PASSWORD=password -p 5432:5432 -d --name childled-postgres postgres:15
```

If you use a local Postgres install, create an `childled_dev` database and make sure the credentials in `artifacts/api-server/.env` match your machine.

3. Apply DB schema:

```bash
pnpm run db:push
```

4. Start the API and frontend together:

```bash
pnpm run dev
```

5. Open http://localhost:5173 and click "Development Login" to verify you can access the demo workspace.

Useful scripts:

- `pnpm run dev` - start API on http://localhost:3001 and web on http://localhost:5173
- `pnpm run dev:api` - start only the API
- `pnpm run dev:web` - start only the frontend
- `pnpm run db:push` - apply the Drizzle schema using `artifacts/api-server/.env`
- `pnpm run typecheck` - run TypeScript checks across the workspace
- `pnpm run build` - typecheck and build all packages

Port overrides:

- Full local dev uses `API_PORT=3001` and `WEB_PORT=5173` by default.
- Frontend-only dev uses `PORT=5173` and `BASE_PATH=/` by default.
- Set `DEV_API_ORIGIN` if the frontend should proxy `/api` to a different API server.

Notes:

- The project previously used Replit-specific plugins and object storage. The codebase now defaults to `local-encrypted` in development.
- Replit Vite plugins are optional. They are skipped automatically when the packages are not installed locally.
