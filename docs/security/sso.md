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

| Setting | Value |
|---------|--------|
| Redirect URI (local) | `http://localhost:3000/api/auth/callback/microsoft` and/or `:3001` |
| Redirect URI (prod) | `https://precon.brasfieldgorrie.app/api/auth/callback/microsoft` |
| API permission | Microsoft Graph `User.Read` (delegated) |
| Optional claims | `email`, `preferred_username` on ID token |
| Groups | Emit `groups` claim matching Admin Access keys (e.g. `BG-Precon-PCM`, `BG-Region-Central`) |

## Local vs production mapping

- **Production:** `mapIdentityStrict` — unmapped groups → access denied.
- **Local (`APP_ENV=local`):** if groups are missing, falls back to Access Settings `defaultRole` so you can test OAuth before group claims are configured. Domain allowlist still applies.

## Edge gate

`src/proxy.ts` in SSO mode redirects HTML to `/sign-in` and returns 401 for APIs when the Better Auth session cookie is absent. Full validation runs on the server.

## Legacy proxy headers

The older trusted reverse-proxy model (`x-precon-sso-trust`, `x-forwarded-email`, …) is documented in `sso-proxy-trust.md` and remains as helper code for tests/migration. It is **not** the primary production path.
