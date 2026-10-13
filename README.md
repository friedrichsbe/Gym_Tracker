# Gym Tracker

Personal, local-first strength-training log (PWA).

- Product spec: [docs/Gym_Tracker_PRD.md](docs/Gym_Tracker_PRD.md)
- **Current scope, decisions and status: [docs/Gym_Tracker_PRD_Addendum_v0.2.md](docs/Gym_Tracker_PRD_Addendum_v0.2.md)** (wins over the PRD where they differ)

React + TypeScript + Vite, Dexie/IndexedDB for storage, no backend, no accounts.

## Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server (http://localhost:5173)            |
| `npm test`          | Unit tests (Vitest + fake-indexeddb)          |
| `npm run typecheck` | Strict TypeScript check                       |
| `npm run lint`      | oxlint                                        |
| `npm run build`     | Production build incl. service worker         |
| `npm run icons`     | Regenerate PWA icons in `public/icons`        |

## Structure

```
src/
  domain/      entity types (PRD §12), time + collection helpers
  data/        Dexie schema (v2), settings, live-query hooks
  workout/     session lifecycle, set logging, substitution (service + UI)
  daytypes/    user-defined training days (Leg/Upper/Mix/…): which exercises fit a day
  routines/    presets: CRUD, "save workout as preset", editor
  exercises/   catalogue, search, starter seed, picker (suggested vs. outside the day)
  locations/   location CRUD + picker
  history/     workout list and detail (edit sets, repeat, save as preset, delete)
  analytics/   pure statistics + activity heatmap (day/week/month/year) + exercise progress
  portability/ JSON/CSV export, validated import with preview, reset
  settings/    preferences, statistics options, backup reminder
  app/         shell, routing, onboarding, PWA update handling
  ui/          small shared components (Sheet, Toast, NumericField, …)
```

Domain logic lives in `*Service.ts` files (no React) so the storage layer can change without touching the UI.

## Data model rules worth remembering

- The performed **set** is the source of truth; every set stores its own location (+ name snapshot) and unit.
- Substituting an exercise after sets were logged never rewrites them: the logged sets stay with the exercise
  actually performed and the replacement becomes a new instance that still points at the planned exercise.
- Locations and exercises are archived, never hard-deleted.
- Zero, "bodyweight" and "unknown" load are distinct (`weightValue: null` ≠ `0`, `loadType`).
- The service worker updates only on user request, never mid-workout.
- Training days ("Leg", "Upper", …) are data, not code. An exercise fits a day via muscle tags, an explicit assignment, or
  because it belongs to the session's preset. Exercises outside the day stay available and are flagged `isForeign` (shown in blue — teal when the user picked blue as accent colour).
- Supersets are a label on adjacent exercise instances (`supersetGroupId`); `workout/supersets.ts` keeps them adjacent and ≥ 2.
- Training splits are applied by `applySplit` (archives instead of deleting; reuses days by name).
- Warm-up sets are always stored; whether they count in volume/heatmap/charts is a setting (`includeWarmupsInStats`, default on).
- Statistics are derived at query time from raw sets (`analytics/analytics.ts`); progress series are per location by default.
- Export format v1 (`portability/schema.ts`) is validated on import; imports never silently drop data (missing exercises are
  recreated from name snapshots, repairs are listed as warnings). Replace-mode first hands out a backup of the current data.

## Database migrations

`data/db.ts` keeps every schema version. v2 added `dayTypes` and day-type indexes; existing data survives the upgrade.
