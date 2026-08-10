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
| Production (alias, if used) | `https://precon.brasfieldgorrie.app/api/auth/callback/microsoft` |
| Local | `http://localhost:3001/api/auth/callback/microsoft` |
| Local (alt port) | `http://localhost:3000/api/auth/callback/microsoft` |

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

## Edge gate

`src/proxy.ts` in SSO mode redirects HTML to `/sign-in` and returns 401 for APIs when the Better Auth session cookie is absent. Full validation runs on the server.

## Legacy proxy headers

The older trusted reverse-proxy model (`x-precon-sso-trust`, `x-forwarded-email`, …) is documented in `sso-proxy-trust.md` and remains as helper code for tests/migration. It is **not** the primary production path.
