# Precon Mobile (Expo)

iOS-first Expo Router client for B&G Precon Data Collection.

## Start

```bash
# Terminal 1 — web API (from Untitled/)
npm run dev

# Terminal 2 — mobile
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

Press `i` for iOS Simulator.

## Environment

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the Next.js app (default `http://localhost:3000`) |
| `EXPO_PUBLIC_FORCE_THEME` | Optional `light` \| `dark` \| `system` — **dev screenshots only**; overrides stored preference. Leave unset for normal use. |

For Expo Go on a physical device use LAN, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.68:3000 npx expo start --lan`.

## Auth

- **Demo personas** — pick a seeded user when `AUTH_MODE=demo` on the server
- **API token** — paste a `pcn_…` bearer from Admin → API Tokens

## Design

Liquid glass via `expo-blur` + B&G navy/steel tokens in `src/theme/tokens.ts`.

- **Typography:** Manrope (`@expo-google-fonts/manrope`)
- **Theme:** light / dark / system (Settings + header moon/sun toggle)
- **Chrome:** blur tab bar, glass headers, Chip / ListRow primitives

Visual evidence: `.smoke-shots/mobile/ui-light.png` and `ui-dark.png`.
