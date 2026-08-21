# SSO — Better Auth + Microsoft Entra

Primary production identity is **Microsoft Entra ID** via [Better Auth](https://www.better-auth.com/docs/authentication/microsoft). The app does not store passwords.

## Flow

1. User opens `/sign-in` → **Sign in with Microsoft**.
2. Better Auth handles OAuth at `/api/auth/*` and stores session rows in BA tables (`user`, `session`, `account`, `verification`).
3. `getCurrentUser()` loads the BA session, reads Entra claims from the Microsoft `id_token` when present (`groups`, `jobTitle`, `name`, `email`), and maps **email → app `users`** (`resolveSsoUser` / Admin Access map).

**Roster matching**
- Join key: **email** (case-insensitive). Existing seed / roster rows are reused on first SSO.
- **Name:** Entra display name when it is a real name; otherwise keep the roster name (avoids overwriting “Sarah Chen” with `schen`).
- **Title:** Entra `jobTitle` when present → existing roster title → role label (e.g. “PCM (Preconstruction Manager)”). Never leaves a permanent “Signed in via SSO” placeholder when better data exists.
- **Role / region:** from Entra groups via Admin Access mapping (local can fall back to defaultRole).

App authorization (role, region, sheet ACLs) still uses the integer `users` table — not Better Auth’s string-id `user` table.

## Required environment

```bash
AUTH_MODE=sso
APP_ENV=local          # or production
SSO_ALLOWED_DOMAINS=brasfieldgorrie.com
BETTER_AUTH_SECRET=    # openssl rand -base64 32 (≥32 chars)
BETTER_AUTH_URL=https://your-origin
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
APP_ORIGIN=https://your-origin
ALLOWED_ORIGINS=https://your-origin
```

## Entra app registration

App (client) ID: `2c520da3-96dd-44d4-a9a4-dc63e4898a54`  
Tenant ID: `52ccbd12-0e54-4e46-ab66-c49c6472d277`

### Redirect URIs (platform type: **Web** — not SPA)

Add **exactly** these under **Authentication → Platform configurations → Web → Redirect URIs**:

| Environment | Redirect URI |
|-------------|--------------|
| Production | `https://precon-data.magnus.brasfieldgorrie.app/api/auth/callback/microsoft` |
| Production (alias) | `https://precon-data-prod.magnus.brasfieldgorrie.app/api/auth/callback/microsoft` |
| Preview (per branch) | `https://precon-data-git-<branch>.magnus.brasfieldgorrie.app/api/auth/callback/microsoft` |
| Local | `http://localhost:3000/api/auth/callback/microsoft` |
| Local (alt port) | `http://localhost:3001/api/auth/callback/microsoft` |

Preview SSO only works after those URIs exist in Entra **and** Preview has `AUTH_MODE`, `APP_ORIGIN`, `BETTER_AUTH_URL`, and the Microsoft secrets (Production has them; Preview did not as of 2026-08-17). See [github-and-vercel.md](../github-and-vercel.md).

**AADSTS50011** means the URI in the authorize request is missing from that list (character-for-character match required).

Also set:
- **Supported account types:** single tenant (this directory only), unless multi-tenant is intentional  
- **API permission:** Microsoft Graph `User.Read` (delegated), admin consent if required  
- **Optional claims (ID token):** `email`, `preferred_username`  
- **Groups:** emit `groups` claim matching Admin Access keys (e.g. `BG-Precon-PCM`, `BG-Region-Central`)

Portal deep link (Authentication blade):  
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/2c520da3-96dd-44d4-a9a4-dc63e4898a54

## Local vs production mapping

- **Production:** `mapIdentityStrict` — unmapped groups → access denied.
- **Local (`APP_ENV=local`):** if groups are missing, falls back to Access Settings `defaultRole` so you can test OAuth before group claims are configured. Domain allowlist still applies.

## Local development

`.env.development` is **demo personas** (`AUTH_MODE=demo`). `.env.local` wins. `npx vercel env pull` copies Development/Production values into `.env.local` and will put `AUTH_MODE=sso` plus the **production** `APP_ORIGIN` on your laptop unless you rewrite the local origins:

```
APP_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
```

Then restart `pnpm run dev`. For personas instead of Entra, also set `AUTH_MODE=demo`.

**Wrong-port callback.** Microsoft redirects to `{BETTER_AUTH_URL}/api/auth/callback/microsoft`. If that URL is `:3001` and Next is on `:3000`, the browser shows “site can’t be reached.” Entra has both `localhost:3000` and `:3001` registered. Local Better Auth (`src/lib/auth-base-url.ts`) follows the request Host for loopback, so a leftover `:3001` env is not fatal after restart — as long as you start the OAuth flow from the port that is actually listening. Do not reuse an old `?code=` URL; codes are one-shot.

**`/` ↔ `/sign-in` 307 loop.** `/sign-in` must not treat a `session_token` cookie as signed-in. A stale cookie plus `(app)/layout` `getSession` bounces forever. Presence is only an edge-proxy hint (`cookiesLookLikeBetterAuthSession`). The sign-in client calls `getSession()` before leaving the page; `getCurrentUser()` redirects to `/sign-in` when there is no live session.

See [github-and-vercel.md](../github-and-vercel.md) for the env-pull checklist.

## Edge gate

`src/proxy.ts` in SSO mode redirects HTML to `/sign-in` and returns 401 for APIs when the Better Auth session cookie is **absent**. Cookie presence is not a validated session. `(app)/layout` and `getCurrentUser()` still call Better Auth `getSession`.

## Legacy proxy headers

The older trusted reverse-proxy model (`x-precon-sso-trust`, `x-forwarded-email`, …) is documented in `sso-proxy-trust.md` and remains as helper code for tests/migration. It is **not** the primary production path.
