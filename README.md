# legion-web

The Legion web app: React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query and React Router. It talks to [legion-api](https://github.com/swahome/legion-api) over `/v1`.

## Run it

You need Node 22 and a running legion-api (see its README; `./bin/legion-api serve` listens on `:8080` by default).

```sh
npm ci
cp .env.example .env   # only if the API isn't on http://localhost:8080
npm run dev            # http://localhost:5173
```

The dev server proxies `/v1` to `LEGION_API_URL`, so the app and API share one origin. That matters: the API's refresh token is an HttpOnly, `SameSite=Strict` cookie scoped to `/v1/auth`. For local HTTP, start the API with `LEGION_COOKIE_SECURE=false`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the API proxy |
| `npm run typecheck` | `tsc -b` (strict, `noUncheckedIndexedAccess`) |
| `npm test` | Vitest + Testing Library in jsdom |
| `npm run build` | Typecheck, then a static build in `dist/` |

## Deploying

`npm run build` produces static files in `dist/`. Serve them from the same origin as the API, with `/v1/*` going to legion-api and every other path falling back to `index.html` (client-side routing). For example with Caddy:

```
legion.example.com {
  handle /v1/* { reverse_proxy localhost:8080 }
  handle { root * /srv/legion-web/dist; try_files {path} /index.html; file_server }
}
```

## How it's put together

- `src/api/client.ts`: fetch wrapper. The access token lives in memory only; a page load restores the session by calling `/v1/auth/refresh` with the cookie. A 401 triggers one shared refresh and a retry, because the API rotates the refresh token on every use and treats a replay as theft.
- `src/api/hooks.ts`: one TanStack Query hook per endpoint, with mutations that invalidate the group's cached data.
- `src/auth/AuthProvider.tsx`: session state for the router guard and the login page.
- `src/components/`: the app shell (sidebar, group switcher, mobile drawer), the statement view and a small UI kit.
- `src/pages/`: one file per screen.

## Screens (slice 1)

| Route | Who | |
| --- | --- | --- |
| `/login` | everyone | Phone or email and password |
| `/` , `/groups` | signed in | Group picker; `/` jumps into the last group used |
| `/g/:id` | members | Overview: my balance, group stats, contributions |
| `/g/:id/statement` | members | My contribution statement with date and contribution filters, CSV export |
| `/g/:id/members` | members | Member directory; officials can search by phone, filter by status and add members |
| `/g/:id/members/:memberId` | officials, or yourself | Member details and statement; officials can edit office, number and status |
| `/g/:id/contributions` | members | Contributions (hidden ones for officials only) |
| `/g/:id/contributions/new`, `/:contributionId` | officials edit | Create and edit, with schedule and member selection |
| `/g/:id/arrears` | officials | Every active member's balance, most owed first |

Money comes from the API as two-decimal strings and is only formatted here, never summed for anything stored.
