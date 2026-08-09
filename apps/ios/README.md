# Precon Native (SwiftUI)

Native iOS client for B&G Precon — **same** Next.js mobile REST API as Expo (`apps/mobile`):

`/api/v1/mobile/**`

Use this app to compare Expo vs native side-by-side.

## Prerequisites

- Xcode 15+ (this machine uses **Xcode-beta** at `/Users/robert/Downloads/Xcode-beta.app`)
- [xcodegen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Running Precon API: from `Untitled/` → `npm run dev` (port **3000**, `AUTH_MODE=demo`)

## Configure API base URL

Default: `http://127.0.0.1:3000` (Simulator → host).

Override:

1. **Info.plist** key `API_BASE_URL`, or  
2. UserDefaults key `apiBaseURL`

Physical device: use your Mac LAN IP, e.g. `http://192.168.1.68:3000`.

## Generate project & run

```bash
export DEVELOPER_DIR=/Users/robert/Downloads/Xcode-beta.app/Contents/Developer

cd Untitled/apps/ios
xcodegen generate
open PreconNative.xcodeproj

# CLI
xcodebuild -scheme PreconNative -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -scheme PreconNative -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## Feature parity (shared backend)

| Area | Native | API | Notes |
|------|--------|-----|--------|
| Sign-in | Demo personas + `pcn_*` | `/auth/demo`, `/users`, `/me` | Keychain token |
| Overview | KPIs + status chart | `/overview` | Swift Charts |
| Bid Schedule | Timeline / list, new pursuit, job | `/bid-schedule`, `/pursuits`, `/jobs/:id` | Due-date bands |
| Post-Bid | Queue filters, full field form, lock | `/rounds/*` | Optional toggle hides optional **including multi** |
| Sheets | Search, folder sections, rank sort, human titles, pin/archive/restore, multi-column grid, cell edit | `/sheets*`, `?archived=1`, PATCH pin/archive/restore | Views read-only; create grid (non-leadership) |
| Dashboards | Level chips + charts | `/dashboards?level=` | Corporate/region/division groupBy |
| Forecast | Dual series | `/forecast` | |
| Studio | List + **board detail widgets** | `/dashboards`, `/dashboards/:id` | |
| Reports | Preset **run + save**, saved list | `GET/POST /reports` | |
| Annual | Yearbook years | `/reports/annual` | |
| Admin | Section list + **section detail** (lists/destini mutations, row browse) | `GET/POST /admin` | Not every admin mutation (web Destini confirm, etc.) |
| Trash | List + **Restore** | `GET/POST /trash` | |
| Reconciliation | **Paste CSV + Upload** | `POST /reconciliation` | Same CSV body as Expo |
| Magnus AI | Ask prompt | `POST /copilot` | |
| Search / Notifications / Settings | Full | matching routes | |

### Intentionally lighter than web (not Expo stubs)

- Admin: list/browse + sample list-add + Destini **preview**; full Destini confirm, Salesforce decide, distribution send remain web-first.
- Reports: preset run/save (not full report builder UI).
- Studio: view board + widgets (not widget editor).

## Compare to Expo

```bash
# Terminal A — API
cd Untitled && npm run dev

# Terminal B — Expo
cd Untitled/apps/mobile && EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 npx expo start --lan

# Terminal C — Native
cd Untitled/apps/ios && xcodegen generate && open PreconNative.xcodeproj
```

## Tests

`PreconNativeTests` — formatters, due bands, sheet matrix, field visibility (optional multi), JSON decode of live API shapes.
