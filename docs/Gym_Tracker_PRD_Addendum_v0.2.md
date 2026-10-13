# Gym Tracker — PRD Addendum v0.2 (Extended Vision & Scope)

**Status:** Living document · **Date:** 13 October 2026
**Relates to:** [Gym_Tracker_PRD.md](Gym_Tracker_PRD.md) (Draft 0.1)
**Rule of precedence:** where this addendum and the original PRD differ, **this addendum wins**. Everything in the
original PRD that is not mentioned here still applies (local-first PWA, per-set truth, honest statistics, no account,
no social/AI/coaching).

This file is the single place to look up *what the product is meant to do now*, *which decisions were taken*, *what is
built*, and *what is next*. Update it whenever scope or a decision changes.

---

## 1. What changed in the vision

The original PRD described a fast set logger with location-aware history. Using it as the baseline, the product grew
around one extra idea:

> **Structure is a suggestion, never a cage.** The app proposes a sensible workout for the day you are about to do, but
> every part of it — exercises, order, grouping, location — can be changed while training, and the history records
> what *really* happened, including where you deviated from the plan.

New product principles (added to PRD §2):

8. **The user's training split is theirs.** Leg/Upper/Mix, Push/Pull/Legs, body-part splits, full body — all are
   data the user can pick or customise, not code. Nothing in the app assumes one split.
9. **Deviation is visible, not punished.** Exercises outside the chosen day, replaced exercises and supersets are
   marked (colour **and** text) so history stays honest, but never blocked.
10. **Everything can become a preset.** A finished workout is one tap away from being a reusable preset.
11. **Statistics follow the user's choices.** Whether warm-ups count, whether supersets are included — per user, per view.

---

## 2. New and changed features

Numbering continues the original PRD (F1–F16). Status: ✅ built · 🟡 partly · ⬜ open.

### F17 — Training days & splits ✅
- A **training day** ("day type") is a user-defined label with a rule for which exercises fit it: muscle groups,
  explicit exercises, or "everything fits" (mixed / full-body days).
- Built-in **splits** can be applied in one step: *Leg / Upper / Mix* (default), *Push / Pull / Legs*,
  *Upper / Lower*, *Full body*, *Body-part split* (chest, back, shoulders, arms, legs). The split can be chosen at
  onboarding and changed any time.
- Fully customisable: add, rename, reorder, archive days; edit muscle groups; list individual exercises.
- The day selection is visible on the start screen but its **configuration lives in Settings**. The start screen has an
  "⚙ Edit days" link that jumps straight to *Settings → Training days*, so anyone can find and change their split.
- **Rules:** switching split never deletes anything. Days that are not part of the new split are archived (restorable);
  days with the same name are reused, so presets and custom muscle mapping survive switching back and forth. Past
  workouts keep their day name as a snapshot.
- **Acceptance:** a user with a Push/Pull/Legs routine can set that up in under a minute and never sees Leg/Upper again;
  switching back restores their old days unchanged.

### F18 — Two-step workout start ✅
1. **Which day?** (chips: the user's days + *Free*; the last choice is remembered). Location is chosen on the same screen.
2. **What to do?** Presets of that day (presets of other days collapsed below), **or** pick exercises that fit the day,
   **or** start empty.
- *Free* = no day: all presets, all exercises, nothing is flagged.
- **Acceptance:** from opening the app to the first logged set takes ≤ 3 taps when a fitting preset exists.

### F19 — Exercises outside the day ("foreign exercises") ✅
- Pickers show exercises that fit the day first. Everything else is reachable under **"Other exercises"** and by search.
- An exercise added to a workout although it does not fit the day is stored with `isForeign = true` and shown with a
  **blue rail + "Outside <day>" label** — in the workout, in history and in the activity detail.
- Exercises that belong to the workout's own preset always count as inside.
- After adding one, the user may choose **"Count as <day>"** so it fits next time.
- Creating a custom exercise offers "Counts as <days>" (default: the current day).

### F20 — Presets (formerly "routines") ✅
- A preset suggests exercises with sets and a rep range per exercise, belongs to a day (or "any day"), and may contain
  supersets. Editing a preset never changes running or past workouts (each session snapshots its plan).
- **Create** from scratch, **duplicate**, **archive/restore**, **edit** (reorder, add via picker, sets, rep range).
- **Save a finished workout as a preset** — offered right after finishing, and from any workout in History. Uses what
  was *actually performed*: exercises with completed sets, in order, number of working sets, rep range, supersets.
  Warm-ups are not counted as sets.
- **Repeat this workout** (History) starts a new workout with the same exercises and supersets.
- Presets are suggestions only: in the workout everything can be added, reordered, replaced or skipped.

### F21 — Supersets ✅
- Two or more **adjacent** exercises can be bundled: one set of each in turn, no rest in between (3 exercises = *tri-set*,
  4+ = *giant set*). Created from an exercise's menu ("Superset with the next exercise"), in preset editors, or via a
  preset/repeat that contains one.
- **Tracking is unchanged**: every exercise logs weight, reps and set type as usual. The superset is a label on the
  exercise instance (`supersetGroupId`), nothing more.
- **Visual:** a violet frame around the group with a *SUPERSET* label (also text, not colour only) and an **"Up next"**
  hint that alternates A, B, A, B … based on completed sets. Shown in the workout, history, presets and the activity
  detail.
- **Rules:** members stay adjacent (a superset moves as one block; nothing can be dropped into its middle); a group
  always has ≥ 2 members (removing/unlinking one of two dissolves it); substituting a member keeps the superset.
- **Statistics:** sessions in which an exercise was done as a superset are marked ("SS", hollow chart marker) and can be
  hidden from that exercise's progress, because the effort differs.
- **Not in scope yet:** a dedicated superset rest timer, per-superset notes, automatic round counting.

### F22 — Warm-up policy ✅
- Warm-up sets are **always stored**, always visible in workout and history, and exported.
- Whether they **count** in volume, the activity calendar and progress charts is a setting
  (*Settings → Statistics*, default **on**). Records and charts say which way they are computed.

### F23 — Activity calendar (heatmap) ✅
- *Progress → Activity*, views **Day / Week / Month / Year**, with previous/next/Today.
- **Year:** one small square per day (GitHub style), scrolls to the selected week. **Month:** calendar grid with set
  count per day. **Week:** seven tiles; **every completed set is its own small square** (warm-ups hollow). **Day:** the
  day's workouts with every set as a chip (weight × reps), outside-day and superset marks.
- Colour by **sets**, **volume** (load × reps; lb converted to kg only for comparing days) or **workouts**. Five levels
  based on quartiles of the user's own non-zero days, so one extreme day cannot wash out the rest.
- Every cell is a button with a full text label (accessible); selecting a day shows its details underneath.

### F24 — Exercise progress ✅ (basic)
- *Progress → Exercises*: choose exercise and **location** (default: the most recent one). Metrics: top weight, volume,
  best reps. Raw points are shown (no smoothing), plus records (heaviest set, most reps, best set volume — ties go to
  the heavier/longer set) and a table of sessions.
- **"All locations (not comparable)"** is an explicit opt-in and uses different marker shapes per location.
- Not yet: estimated 1RM, weekly volume per muscle group, frequency statistics (still F13).

### F25 — Portability & backup ✅ (supersedes F8/F10 scope)
- **JSON export (format v1)** with *everything*: locations, exercises, training days, presets (with supersets),
  sessions → exercise instances → sets, settings. Round-trip tested to be lossless.
- **CSV export** as ZIP: `sets.csv`, `sessions.csv`, `workout_exercises.csv`, `exercises.csv`, `locations.csv`,
  `day_types.csv`, `routines.csv`, `routine_exercises.csv` plus a `README.txt` documenting every column, enum, unit,
  timestamp and null rule. Share sheet where the browser supports it, otherwise download.
- **Import (JSON)** validates the file (schema, size, newer-version check), shows a **preview** (counts, what will be
  added, warnings) and offers **Add to my data** (merge; existing items skipped) or **Replace everything** (a backup
  of the current data is handed out first). Import is all-or-nothing in one transaction. Nothing is silently
  dropped: a missing exercise is recreated from the workout's name snapshot; every repair is listed.
- **Backup reminder** after 7/14/30 days (or never); last backup date is shown only because it is really tracked.
- **Danger zone:** delete all data requires typing `DELETE`.
- **Dropped from scope:** importing the old Obsidian/Markdown table (F14). It was a transition solution; the user
  decided it is not needed. CSV *import* is also not planned (JSON is the restore path).

### Carried over unchanged from the original PRD (built) ✅
F1 logging (autosave, recovery of the active workout after reload, undo for deleted sets), F2 locations at set level,
F4 catalogue + custom exercises (alias search, typo tolerant), F5 substitution (logged sets stay with the exercise
actually performed), F6 history (list, filters, detail, edit sets, delete workout), F9 installable offline PWA with
user-controlled updates.

---

## 3. Data model delta (schema v2 and fields added since)

| Entity | Added / changed |
|---|---|
| `DayType` (new table, schema v2) | `name`, `muscleTags[]`, `exerciseIds[]`, `matchAll`, `position`, `archivedAt` |
| `Routine` | `dayTypeId` (null = any day) |
| `RoutineExercise` | `supersetGroup` (same key = superset) |
| `WorkoutSession` | `dayTypeId`, `dayTypeNameSnapshot` |
| `WorkoutExercise` | `isForeign`, `supersetGroupId` |
| `AppSettings` | `includeWarmupsInStats`, `lastDayTypeId`, `dayTypesSeeded`, `lastExportAt`, `backupReminderDays` |

- Dexie schema **v2** added `dayTypes` and day-type indexes; v1 databases upgrade in place without data loss.
  Fields that are not indexed (`isForeign`, `supersetGroupId`, `supersetGroup`) need no schema bump; absent = `false`/`null`.
- Export **formatVersion stays 1**; the new fields are optional with defaults, so older v1 files still import.
- Rule reminder: statistics are *derived at query time* from raw sets; nothing aggregated is stored.

## 4. Decisions taken (replaces the "Open decisions" register where listed)

| Decision | Outcome |
|---|---|
| PWA vs native | PWA, to be validated on the real Samsung phone. |
| Cloud sync | None. Local-first with manual backup/restore. |
| Backup | JSON (restorable) + CSV ZIP; share sheet if available; reminder interval. No Drive integration. |
| Machine comparability | Location is the comparison scope; progress is per location by default; mixed view is explicit. |
| Units | Each set stores its own unit; setting only affects new sets; charts convert to the display unit. |
| Exercise catalogue | ~50 seeded exercises (with German aliases) + custom ones; seeding is optional at onboarding. |
| Training split | User-defined; ready-made splits; configuration lives in Settings, linked from the start screen. |
| Warm-ups in statistics | Setting, default **included**. |
| Legacy Markdown import | **Dropped.** |
| Timer behaviour | Still open (rest timer not built). |
| UI language | English for now; German UI **open** (would need a string table). |
| Monetisation / public release | Personal tool, unchanged. |

## 5. Status against the original feature list

| ID | Feature | Status |
|---|---|---|
| F1 | Local-first workout logging | ✅ |
| F2 | Locations at set level, scope on mid-workout change | ✅ |
| F3 | Flexible routines/templates | ✅ (as presets, F20) |
| F4 | Catalogue & custom exercises | ✅ (no merge tool for duplicates yet) |
| F5 | Exercise substitution | ✅ |
| F6 | History & session detail | ✅ |
| F7 | Basic progress analytics | ✅ (F24) |
| F8 | Export & import | ✅ (F25; JSON import only) |
| F9 | Offline PWA | ✅ (to verify on device) |
| F10 | Backup workflow | ✅ |
| F11 | Rest timer | ⬜ |
| F12 | Advanced set metadata (RPE/RIR/tempo) | 🟡 stored/validated in the model, no input UI |
| F13 | Better analytics (e1RM, weekly volume per muscle, frequency) | ⬜ |
| F14 | Markdown importer | dropped |
| F15 | Routine versioning, alternatives | ⬜ |
| F16 | Desktop analysis view | 🟡 responsive layout with sidebar; no table/keyboard mode |

## 6. Backlog / next ideas (not committed)

1. Real-device pass on the Samsung phone (tap sizes of heatmap squares, one-handed logging, airplane mode, install).
2. Rest timer (per exercise, dismissible, superset-aware: rest after the round, not between members) — F11.
3. RPE/RIR input behind progressive disclosure — F12.
4. Estimated 1RM (labelled, formula shown), weekly volume per muscle group, training frequency — F13.
5. Merge tool for duplicate exercises with preview.
6. German UI / string table.
7. Optional machine identifier below location level.
8. Desktop table view and keyboard shortcuts — F16.
9. Encrypted optional sync and/or native wrapper — only if the PWA proves insufficient.

## 7. Acceptance criteria — additions to Appendix A

16. Choose a split at onboarding; switch to another in Settings and back without losing days, presets or history.
17. Start a workout via *day → preset*, via *day → picked exercises*, and as *Free*.
18. Add an exercise outside the day: it is marked blue with its day label in the workout, in history and in the export.
19. Create a superset, log alternating sets; the "Next" hint alternates; the frame shows in workout, history and preset.
20. Moving or removing exercises can never leave a superset split apart or with a single member.
21. Finish a workout and save it as a preset; start it again and get the same exercises and supersets.
22. Toggle "count warm-ups" and see volume, calendar and charts change; the warm-up sets themselves never disappear.
23. Calendar shows Day/Week/Month/Year, with one square per set in Week; every cell has a text label.
24. Export JSON, wipe the app, import it: entity counts and values match; the same file imported twice adds nothing.
25. Replace-import hands out a backup of the current data before touching it; a broken file changes nothing.

## 8. Glossary

- **Day / day type** — the kind of training day (Leg, Push, Full body, …) chosen when starting a workout.
- **Split** — a set of days that together describe a weekly structure (e.g. Push/Pull/Legs).
- **Preset** — a reusable suggested workout for a day; formerly "routine".
- **Foreign / outside exercise** — an exercise added although it does not fit the workout's day.
- **Superset** — exercises done alternately, one set each, without rest in between.
- **Instance** — one exercise within one workout (`WorkoutExercise`); sets belong to instances.
