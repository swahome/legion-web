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

`npm run build` produces static files in `dist/`. Serve them and the API from the same site: the web server serves `dist/` and forwards `/v1/*` to legion-api, which listens on its own port on the same host and is bound to loopback. The browser only ever talks to the site, so the refresh cookie stays on one origin. Any path that isn't `/v1` falls back to `index.html`, because routing happens in the browser.

For example, with the site at `https://legion.com` and the API's `.env` set to `LEGION_ADDR=127.0.0.1:8089` and `LEGION_COOKIE_SECURE=true`:

```
legion.com {
  handle /v1/* { reverse_proxy 127.0.0.1:8089 }
  handle { root * /srv/legion-web/dist; try_files {path} /index.html; file_server }
}
```

Don't expose the API port to the internet. The API trusts `X-Forwarded-For` for the client IP that the login lockout counts, so only the proxy should reach it. The legion-api README has the details, including the nginx header to set.

## How it's put together

- `src/api/client.ts`: fetch wrapper. The access token lives in memory only; a page load restores the session by calling `/v1/auth/refresh` with the cookie. A 401 triggers one shared refresh and a retry, because the API rotates the refresh token on every use and treats a replay as theft.
- `src/api/hooks.ts`: one TanStack Query hook per endpoint, with mutations that invalidate the group's cached data.
- `src/auth/AuthProvider.tsx`: session state for the router guard and the login page.
- `src/components/`: the shared shell (sidebar, mobile drawer), the group shell and menus, the statement view and a small UI kit.
- `src/api/admin.ts`: hooks for the platform admin endpoints.
- `src/pages/`: one file per screen; `src/pages/admin/` holds the admin panel.

## Sections and screens

One app, one login, three sections. Each person lands in the section their role allows:

- `/admin`: platform admins (the `admin` platform role). Everyone else is sent to `/groups`.
- `/group/:id`: a group's officials, and platform admins opening any group. Members who aren't officials are sent to `/member/:id`.
- `/member/:id`: a group's members. Officials can switch to it with "View as a member", which hides the official tools.

Old `/g/:id/...` links redirect to `/group/:id/...`.

Menus are fixed in code (`src/components/menus.ts`). Platform admins can switch group and member menu items off under Admin → Settings and menus; the API returns the switched-off ids in `/v1/me` as `disabled_menus`.

| Route | Who | |
| --- | --- | --- |
| `/login` | everyone | Phone or email and password |
| `/` , `/groups` | signed in | Group picker and the admin panel link; `/` jumps into the last group used |
| `/group/:id`, `/member/:id` | officials, members | Overview: my balance, group stats, contributions |
| `…/statement` | members | My contribution statement with date and contribution filters, CSV export |
| `…/members` | members | Member directory; officials can search by phone, filter by status and add members |
| `…/members/:memberId` | officials, or yourself | Member details and statement; officials can edit office, number and status |
| `…/contributions` | members | Contributions (hidden ones for officials only) |
| `/group/:id/contributions/new`, `/:contributionId` | officials edit | Create and edit, with schedule and member selection |
| `/group/:id/arrears` | officials | Every active member's balance, most owed first |
| `/admin` | platform admins | Platform counts and recent admin changes |
| `/admin/groups` | platform admins | Search groups, open one as an official, suspend, close or reactivate |
| `/admin/users`, `/admin/users/:id` | platform admins | Search, add and edit users, platform roles, set passwords, deactivate |
| `/admin/transactions` | platform admins | Ledger entries across every group, with filters |
| `/admin/banks`, `/admin/banks/:id` | platform admins | Banks and their branches |
| `/admin/places` | platform admins | Countries (and the default country) and counties |
| `/admin/settings` | platform admins | Menu switches and the imported platform settings |
| `/admin/audit` | platform admins | The latest 100 admin changes |

Money comes from the API as two-decimal strings and is only formatted here, never summed for anything stored.
