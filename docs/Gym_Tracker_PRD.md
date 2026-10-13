# Gym Tracker --- Product Requirements Document (PRD) & Technical Design Specification

> **Update 13 Oct 2026:** the extended scope and all decisions since this draft are in
> [Gym_Tracker_PRD_Addendum_v0.2.md](Gym_Tracker_PRD_Addendum_v0.2.md). Where they differ, the addendum wins.

**Status:** Draft 0.1 --- product and architecture decisions
intentionally open where noted\
**Date:** 13 October 2026\
**Product type:** Personal, mobile-first strength-training tracker;
initially single-user and local-first\
**Working name:** Gym Tracker (temporary)

## 1. Executive Summary

Gym Tracker is a personal strength-training log designed around one
high-value moment: recording a set quickly, accurately, and without
breaking focus during a workout. It replaces the user's current manual
Markdown/Obsidian table workflow with a polished, responsive interface
for logging exercises, sets, repetitions, load, training location, and
optional contextual details. After training, it turns those records into
trustworthy history, progress charts, personal records, and reusable
exports.

The defining product decision is to treat **the individual performed set
as the source of truth**. Templates are starting points, not rigid
programs; exercises can be substituted mid-session; and every set
records the gym/location so results from different machines or
facilities are not blindly compared. Data remains portable through
documented CSV/JSON exports, with a local-first architecture and a
practical backup path.

-   **Primary audience:** one technically comfortable gym-goer who
    trains at multiple gyms and wants high-quality UX without social,
    coaching, or account-management overhead.
-   **Core value proposition:** log a workout in seconds; understand
    progress later; retain ownership of the data.
-   **Key differentiator:** fast, flexible workout logging combined with
    location-aware performance history and open data portability.
-   **Why now:** modern mobile web capabilities can deliver an app-like
    experience without committing early to a native Android application
    or a hosted SaaS backend.
-   **Initial platform recommendation:** installable Progressive Web App
    (PWA), optimized for Samsung/Android and usable on desktop for
    analysis/export.
-   **Architecture principle:** local-first, offline-capable, exportable
    by design; cloud sync is an explicit later decision, not a
    prerequisite.

## 2. Product Vision

### Long-term vision

Become a dependable personal training data system: effortless to use in
the gym, rich enough to support long-term analysis, and open enough that
the user never feels locked in.

### Mission

Make strength-training records effortless to capture and genuinely
useful over time.

### Product philosophy

1.  **The workout comes first.** The logging UI must remain usable with
    one hand, between sets, under time pressure.
2.  **Fast by default, detailed when wanted.** Common paths should need
    few taps; advanced fields must not clutter every set.
3.  **Templates are flexible plans.** A routine suggests what to do but
    never blocks substitutions, reordering, or ad-hoc exercises.
4.  **Context matters.** Loads on different machines and at different
    locations may not be comparable.
5.  **The user owns the data.** Export must be complete, documented, and
    not gated behind a subscription.
6.  **No account tax.** Authentication, profiles, social feeds, and
    collaboration are out of scope unless a real need emerges.
7.  **Trustworthy statistics beat impressive-looking statistics.**
    Metrics must disclose their assumptions and avoid misleading
    cross-machine comparisons.

### Strategic positioning

A premium-feeling personal tool, not a social fitness network or a
coaching platform. It sits between spreadsheet-level flexibility and the
convenience of a dedicated workout app.

### Market timing

A PWA offers installation, caching, responsive layouts, and offline
operation with a much smaller maintenance burden than separate
Android/iOS clients. If the PWA later proves insufficient for background
behavior, device integration, or platform UX, the domain model and data
format should allow a native client to replace or supplement it.

## 3. Problem Analysis

### Specific pain points

-   Current tracking is a manually maintained Markdown table with dates,
    gym, focus, exercise columns, and compressed set notation.
-   Data entry is inconsistent: a cell may contain `70 / 4x12`,
    `10x80 8x90 11x100`, or `2x8x63`, making automated analysis and
    later reuse harder.
-   A wide table is difficult to scan on a phone during a workout.
-   The log does not provide a smooth flow for starting a routine,
    completing sets, changing exercises, or handling unavailable
    equipment.
-   Two gyms may have different machine models, stack increments,
    leverage, or setup, so the same displayed load is not necessarily
    equivalent.
-   Exercise naming can drift (e.g. similar fly/rear-delt variations),
    complicating long-term charts.
-   Post-workout review requires manual interpretation rather than
    giving immediate progress, volume, consistency, or personal-record
    views.

### Current alternatives

-   Markdown/Obsidian tables and notes.
-   Spreadsheets.
-   General workout logging apps.
-   Notes apps and phone timers.
-   A custom native app, web app, or PWA.

### Why current approaches fail for this user

The existing log is flexible and portable, but manual and weak at live
data entry and analysis. Generic apps may be convenient but can impose
rigid routines, account/cloud models, subscription features, or opaque
exports. A bespoke tracker can fit the workflow precisely, but risks
becoming an overbuilt software project.

### Opportunity gaps

-   Workout-session UI designed for speed rather than for browsing a
    catalogue.
-   Easy substitution without losing the intended exercise or history.
-   Per-set gym context.
-   Explicit distinction between comparable and non-comparable
    equipment.
-   Clear, full-fidelity exports and backups.
-   High-quality interface without social or SaaS complexity.

## 4. Target Users

This is a single-user product initially. Personas are design tools, not
claims about a broader validated market.

### Primary persona: Multi-gym regular

-   **Demographics:** adult, early 20s; trains several times per week.
-   **Behavior:** alternates between two or more gyms; machines and
    available equipment differ.
-   **Technical sophistication:** comfortable with Android, Markdown,
    and structured digital workflows.
-   **Goals:** progressive overload, a clear history, minimal logging
    friction, useful statistics.
-   **Motivations:** visible progress, consistency, better training
    decisions.
-   **Pain points:** occupied/missing machines, different machine
    behavior, cumbersome manual entry.
-   **Buying intent:** initially prefers free/low-cost personal tooling;
    values ownership more than premium coaching features.
-   **Typical workflow:** open app → choose gym → start a flexible
    template → record sets between exercises → substitute equipment if
    necessary → finish → review progress.
-   **Devices:** Samsung Android phone in the gym; desktop browser for
    longer-term review and export.
-   **Quote:** "I want to record a set before I lose track of what I
    just did---not manage a database while I train."

### Secondary persona: Data-oriented reviewer

-   **Demographics:** same user in a different context.
-   **Behavior:** reviews progress over weeks and months, compares
    exercises and locations, exports records into other tools.
-   **Goals:** understand trends without manually cleaning data.
-   **Pain points:** inconsistent labels, incomplete exports, opaque
    calculations.
-   **Quote:** "If I stop using this app, I should still have every
    record in a usable format."

### Power user: Template optimizer

-   Creates multiple routines and variations.
-   Wants to reorder, replace, add, or skip exercises during a session.
-   Wants default sets/reps and target ranges but does not want a rigid
    workout prescription.
-   May later want custom metrics, RPE/RIR, rest timers, and volume
    analysis.

### Enterprise/admin persona

Not applicable for the initial product. No organizations, teams,
coaches, billing admins, or multi-tenant workspaces are required.

## 5. Core Product Strategy

### Product category and core wedge

A local-first strength-training log with exceptional live logging UX and
gym-aware history.

### Expansion opportunities

1.  More advanced analytics (volume by muscle group, estimated 1RM, rep
    PRs, consistency).
2.  Rest timer and lightweight workout guidance.
3.  Optional encrypted sync between devices.
4.  Importers for existing Markdown/CSV logs and exporters for common
    analysis tools.
5.  Optional Android-native client if PWA limitations become
    demonstrably painful.

### Retention loop

A useful cycle, not a manipulative engagement loop: 1. Start a workout
from a template. 2. Log sets with minimal friction. 3. See a clear
summary and progress update. 4. Use the history to make the next workout
easier to plan. 5. Reuse or adapt the template.

### Network effects and moat

There is no meaningful network effect in a single-user tool, and one
should not be invented. Defensibility comes from execution quality,
accumulated personal history, transparent analytics, and trust in data
portability---not from locking data in.

### Monetization strategy

**Initial recommendation: no monetization.** This is a personal tool, so
avoid payment, subscriptions, billing, and paywalls. If the scope later
expands to a public product, revisit a one-time purchase or optional
paid sync/hosting model. Never charge for basic export or access to the
user's own records.

### Go-to-market and distribution

Not relevant to the personal MVP. If shared later: a public landing
page, demo video of the logging flow, transparent privacy/data-export
promise, and Android PWA install instructions. Avoid growth mechanics
and social features until there is evidence they solve a real problem.

## 6. Competitive Analysis

Pricing and current feature details change frequently; this is a
strategic comparison, not a verified live price survey.

  ---------------------------------------------------------------------------------------------------------------------------
  Alternative         Strengths           Weaknesses / trade-offs  Pricing posture         UX / position    Opportunity to
                                                                                                            outperform
  ------------------- ------------------- ------------------------ ----------------------- ---------------- -----------------
  Hevy                Workout logging,    May include              Freemium/subscription   Strong           More tailored
                      routines, history,  social/account/product   model may apply; verify dedicated-app    location context,
                      polished mobile     assumptions not needed   current details before  benchmark        open schema,
                      workflow            here; equipment-location choosing                                 personal-first
                                          semantics need checking                                           simplicity

  Strong              Established         UX and platform behavior Freemium/paid options   Focused logging  Flexible
                      strength log and    must be assessed         may apply; verify       tool             substitutions and
                      workout templates   hands-on; data model may                                          export-first
                                          not match custom                                                  model
                                          location needs                                                    

  FitNotes (Android)  Android-oriented,   Visual polish and        Commonly positioned as  Utility-first    More refined UX,
                      practical logging   cross-device analysis    low-friction/free;                       PWA/desktop
                      and history         may differ from desired  verify current state                     workflow,
                                          bar                                                               location-aware
                                                                                                            analytics

  Google Sheets /     Flexible,           Slow on-phone entry;     Depends on existing     Powerful but not Optimized live
  Excel               accessible,         formulas and formats     subscription            workout-native   set entry and
                      portable            need manual maintenance                                           structured data

  Obsidian/Markdown   Local files, user   Manual set parsing, weak Existing tool cost      Great knowledge  Keep Markdown/CSV
                      control, extensible structured charts,       model                   base, not a      export while
                                          awkward live input                               purpose-built    improving capture
                                                                                           tracker          

  Paper/notes         No setup, works     Hard to search, chart,   Free                    Lowest setup,    Better retrieval
                      offline             and aggregate                                    poor analytics   and statistics

  Custom app/PWA      Exact workflow fit, Build/maintenance        Time cost               Potentially      Ship a narrow,
                      data ownership      burden; no automatic                             excellent if     robust MVP and
                                          quality                                          scoped           avoid
                                                                                                            overengineering
  ---------------------------------------------------------------------------------------------------------------------------

**Competitive validation task:** before locking the design, test the
current versions of 2--3 established apps for: time to log a set,
exercise substitution, offline behavior, per-workout gym context, data
export completeness, and cross-machine history. Do not copy competitor
UX blindly.

## 7. User Experience Strategy

### UX principles

-   **Workout mode is the home screen during training.**
-   One dominant action per set: log or confirm.
-   Use sensible defaults and carry forward last-used values where safe.
-   Numeric input must be easy to edit and must not reset unexpectedly.
-   Keep the next set visible; keep completed sets compact.
-   Never make the user navigate away from the active workout to change
    a location or replace an exercise.
-   Provide undo for accidental actions.
-   Make the difference between a template exercise and the exercise
    actually performed visible but unobtrusive.
-   Avoid comparisons across locations/equipment unless the user
    explicitly chooses to view them.

### Emotional design goals

Calm, focused, premium, reliable. The app should feel like a precise
instrument, not a gamified social network.

### Information architecture

Primary navigation: 1. **Workout** --- active session or start-workout
entry point. 2. **Routines** --- templates and routine editing. 3.
**History** --- past sessions and exercise history. 4. **Progress** ---
charts and personal records. 5. **Settings / Data** --- locations,
units, export/import, backup, preferences.

On a narrow phone, use a bottom navigation bar with 4--5 destinations.
During an active workout, minimize competing navigation and provide a
clear route back to the session.

### Accessibility

-   Target WCAG 2.2 AA for web UI where practical.
-   Touch targets generally 44×44 CSS px or larger.
-   Do not encode meaning through color alone.
-   Support system font scaling and screen readers.
-   Strong contrast in dark and light themes.
-   Keep focus visible for keyboard users on desktop.
-   Numeric fields must have clear labels, not placeholder-only labels.

### Responsiveness

-   Mobile-first for the gym workflow.
-   Desktop optimized for routine editing, history inspection, and
    analytics.
-   No critical action should require hover.
-   Support portrait orientation; landscape may be usable but is not a
    priority.

### Trust and safety UX

This is not a medical or injury-diagnosis product. Avoid claims that
analytics prescribe safe loads. Display data provenance and calculation
definitions. Make deletion and export easy. Do not send workout data to
third parties by default.

### Performance UX goals

-   App shell should open immediately after first load, including
    offline.
-   Common set logging should require minimal taps and no network
    request.
-   Autosave locally as the user edits.
-   Use restrained animations; never delay a logging action for an
    animation.

## 8. Detailed User Flows

### 8.1 First launch / onboarding

**Intent:** begin tracking quickly without creating an account. 1.
Welcome screen explains local-first storage and export/backup. 2. Choose
units (kg/lb; default kg). 3. Create first location or choose "Add
later." 4. Import existing records (optional) or start fresh. 5. Offer a
short guided demo or skip. 6. Land on Workout.

**System:** initialize local database; seed standard exercise catalogue
only if accepted; create app settings; record schema version.

**Edge cases:** user skips location; import has malformed rows; user
closes onboarding midway; local storage is unavailable or nearly full.

**Improvements:** keep onboarding under 60--90 seconds; allow all
choices to be changed later. No authentication step.

### 8.2 Authentication

No authentication in MVP. Local device access is the default. If
multi-device sync is added, authentication and sync are separate
optional capabilities rather than a requirement for basic use.

### 8.3 Main workout loop

1.  Tap **Start workout**.
2.  Select a template or **Blank workout**.
3.  Confirm/select current gym; default to last-used location, clearly
    shown.
4.  View exercise cards in planned order.
5.  For an exercise, enter weight and reps for each set; optionally
    record warm-up/work set, RPE/RIR, and notes.
6.  Tap **Complete set**; persist immediately and show completion
    feedback.
7.  Rest timer may start automatically if enabled, but must be
    dismissible.
8.  Change exercise order, skip an exercise, add an exercise, or
    substitute equipment without losing completed data.
9.  Finish workout; review duration, sets, volume, PRs, and
    incomplete/skipped exercises.
10. Save and return to Workout/History.

**System:** create session; attach each performed set to a location
snapshot/reference; autosave; update local analytics; preserve
incomplete session after accidental close.

**Edge cases:** app killed, phone locks, browser reloads, offline mode,
location changed mid-session, duplicate taps, accidental set completion,
missing weight, bodyweight exercises, unilateral exercises, machine
stack increments, exercise swapped after prior sets.

**UX:** support undo; retain session state; use local timestamps; do not
require all planned exercises to be completed.

### 8.4 Empty states

-   No routines: offer "Start blank workout" and "Create routine."
-   No history: explain that history appears after first completed
    workout.
-   No progress chart: explain minimum data needed.
-   No locations: allow quick location creation at workout start.
-   No export history: provide export action without implying cloud
    backup exists.

### 8.5 Search and discovery

Search exercises by name, alias, muscle group, movement pattern, or
equipment. Results should be fast and forgiving of spelling variations.
Custom exercises must be possible. Do not require the user to browse a
giant catalogue during a workout.

### 8.6 Settings

Manage units, default location, theme, rest timer, set-entry behavior,
data export/import, backup reminders, privacy, and app version/schema.
Location CRUD must be accessible during workouts as well as settings.

### 8.7 Payments

No payment flow in the personal MVP. Do not build billing abstractions
until a public/commercial product is an explicit goal.

### 8.8 Notifications

No push notifications in MVP. Optional local rest timer vibration/sound
may be added if browser/device support is reliable. No engagement
reminders by default.

### 8.9 Collaboration

Out of scope. No shared routines, coach accounts, followers, or social
feed.

### 8.10 Error states

-   **Storage write failure:** retain pending state in memory where
    possible, display clear warning, offer immediate export/retry.
-   **Import parse failure:** show row-level errors and allow partial
    import; never silently discard records.
-   **Export failure:** explain the cause, offer smaller export or
    alternate format.
-   **Unsupported browser feature:** degrade gracefully and explain
    limitations.
-   **Schema migration failure:** preserve original backup; never
    overwrite the only copy.
-   **Offline:** normal logging continues; cloud features, if added
    later, show sync status separately.

### 8.11 Upgrade/paywall

None in MVP.

### 8.12 Retention loop

At the end of a workout, show a useful, quiet summary and the next
relevant trend. On opening History, make previous sessions easy to
reuse. Do not use streak guilt, nagging notifications, or artificial
scarcity.

## 9. Full Feature Breakdown

Priority: P0 = required for MVP; P1 = important next; P2 = later.
Complexity: S/M/L/XL.

### MVP features

#### F1. Local-first workout logging --- P0, L

-   **Purpose:** record actual training with low friction.
-   **Story:** As a user, I can record weight, reps, and set type
    quickly while training.
-   **Requirements:** create session; add/remove/reorder exercises;
    add/edit/delete sets; mark set complete; support warm-up and work
    sets; record timestamps; auto-save; recover active session.
-   **UI:** compact exercise cards; prominent numeric fields; completion
    control; completed sets collapse; undo for destructive actions.
-   **Logic/data:** session → exercise instances → performed sets. Each
    set stores actual values and references to
    session/exercise/location.
-   **Permissions:** local user only.
-   **Edge cases:** zero load, bodyweight, assisted movement, unilateral
    exercise, incomplete set, accidental double tap.
-   **Failure:** local write error must be visible; no silent loss.
-   **Metrics:** median time to log set; set edit/error rate; recovered
    sessions.
-   **Success:** routine set logging is consistently faster than the
    existing manual table.
-   **Complexity:** L.

#### F2. Gym/location management and set context --- P0, M

-   **Purpose:** distinguish training context.
-   **Story:** As a user, I can create locations and know where each set
    was performed.
-   **Requirements:** create/edit/archive locations; quick-select
    current session location; store location on session and
    snapshot/reference on every set; allow location switch mid-session
    with explicit scope.
-   **UI:** current location visible in workout header; change location
    with confirmation: "entire workout from now on" vs "only next set
    onward."
-   **Logic/data:** location ID plus optional location-name snapshot to
    preserve historical meaning if renamed/archived.
-   **Edge cases:** no location; location deleted; mid-session change;
    same location has multiple machines.
-   **Failure:** unresolved location must not prevent logging; allow
    "Unknown / not set."
-   **Metrics:** percentage of sets with known location; location-switch
    correction rate.
-   **Success:** every set can be traced to the intended location.
-   **Complexity:** M.

#### F3. Flexible routines/templates --- P0, M

-   **Purpose:** avoid rebuilding common sessions.
-   **Story:** As a user, I can start from a reusable routine but adapt
    it freely.
-   **Requirements:** create/duplicate/rename/reorder routines; default
    exercises and suggested sets/reps; start session from routine;
    substitutions/additions/skips do not silently alter template;
    optional "save changes back to routine."
-   **UI:** routine cards, quick start, editable exercise list.
-   **Logic/data:** template is distinct from workout session; session
    records template origin but snapshots its own plan.
-   **Edge cases:** routine edited while a workout based on it is
    active; deleted exercise; empty routine.
-   **Failure:** preserve session plan even if template changes.
-   **Metrics:** percentage of sessions started from routine; template
    reuse rate.
-   **Success:** common workouts start quickly without restricting
    real-world changes.
-   **Complexity:** M.

#### F4. Exercise catalogue and custom exercises --- P0, M

-   **Purpose:** normalize history and support gym-specific
    alternatives.
-   **Requirements:** canonical exercise identity, display name,
    aliases, equipment, movement pattern/muscle tags where useful;
    custom exercises; archive rather than hard-delete referenced
    exercises.
-   **UI:** fast search; recent/favorite exercises; add custom exercise
    in context.
-   **Data:** canonical exercise and per-session exercise instance are
    separate.
-   **Edge cases:** similar names, unilateral movement, bodyweight,
    cable vs machine variation.
-   **Success:** low duplicate-exercise creation and quick exercise
    selection.
-   **Complexity:** M.

#### F5. Exercise substitution --- P0, M

-   **Purpose:** handle occupied or unavailable equipment.
-   **Requirements:** replace a planned exercise with another while
    preserving completed sets; retain "planned exercise" and "performed
    exercise" relation; optional reason; allow adding without
    substitution.
-   **UI:** "Replace exercise" action, suggested recent/favorite
    alternatives, no forced catalogue wizard.
-   **Edge cases:** replacement after sets have been logged; one planned
    exercise replaced by multiple alternatives; substitution should not
    rewrite historical records.
-   **Success:** substitution can be completed without losing data or
    derailing the workout.
-   **Complexity:** M.

#### F6. History and session detail --- P0, M

-   **Requirements:** list sessions by date, location, routine/focus;
    view sets, exercises, duration, notes; edit past records with
    audit-safe updated timestamps.
-   **UI:** date-based list and concise session detail.
-   **Edge cases:** incomplete session, duplicate sessions, imported
    records without duration.
-   **Success:** past workout can be found and reviewed quickly.
-   **Complexity:** M.

#### F7. Basic progress analytics --- P0, L

-   **Requirements:** exercise history; load/reps over time; best load
    and rep PRs; total completed sets and volume; filters by location
    and date; clearly distinguish exact exercise/location series from
    aggregated series.
-   **UI:** legible charts, selected time range, contextual notes
    explaining comparison limits.
-   **Logic:** definitions documented; do not merge different machine
    locations into one series by default.
-   **Edge cases:** different units, bodyweight, changed machine,
    incomplete sets, outliers.
-   **Success:** user can answer "am I progressing on this exercise at
    this gym?" without manual calculation.
-   **Complexity:** L.

#### F8. Export and import --- P0, L

-   **Purpose:** make data portable and protect against lock-in.
-   **Requirements:** full JSON export of all entities and metadata; CSV
    export for sessions, exercises, and sets in a documented normalized
    format; schema/version manifest; import current Markdown/CSV where
    feasible; validation preview; duplicate handling; partial import
    reporting.
-   **UI:** "Export all data" and "Import data"; format descriptions and
    last export date (only if actually tracked).
-   **Data:** UTF-8, ISO 8601 timestamps, stable IDs, explicit units,
    documented nulls and enum values.
-   **Edge cases:** malformed input, duplicate rows, changed exercise
    names, CSV commas/quotes, locale decimal separators.
-   **Success:** a user can reconstruct all workout records from export
    without the app.
-   **Complexity:** L.

#### F9. Offline PWA and installability --- P0, L

-   **Requirements:** app shell cached; local data operations work
    offline; installable on Android Chrome where supported;
    reload/reopen recovers active workout.
-   **Edge cases:** storage eviction, private browsing, app update while
    workout active.
-   **Failure:** show storage status and export/backup guidance.
-   **Success:** workout logging never depends on gym Wi-Fi.
-   **Complexity:** L.

#### F10. Backup workflow --- P0, M

-   **Requirements:** manual one-tap full export; clear distinction
    between device storage and backup; restore via import; optional
    reminder to export after a configurable interval.
-   **Recommendation:** first ship downloadable JSON/CSV. Google Drive
    integration is not required; a user can save/share the file to Drive
    through Android's system picker if browser support permits.
-   **Edge cases:** backup is stale, file incomplete, restore into
    non-empty database.
-   **Success:** user understands whether they have a backup and can
    restore it.
-   **Complexity:** M.

### V1 features

#### F11. Rest timer --- P1, M

-   Per-exercise default rest, quick start/skip/adjust, optional
    vibration/sound where supported, no blocking modal. Handle app
    backgrounding and timer drift.

#### F12. Advanced set metadata --- P1, M

-   RPE/RIR, tempo, notes, warm-up/drop set/superset tags. Keep optional
    fields hidden behind progressive disclosure.

#### F13. Better analytics --- P1, L

-   Estimated 1RM for appropriate exercises, rep PRs, weekly volume by
    muscle group, consistency, training frequency, volume trends. Label
    estimates and expose formulas.

#### F14. Markdown importer tuned to current log --- P1, L

-   Parse the current date/location/focus table and compressed set
    strings where possible. Show a preview and unresolved cells; never
    pretend ambiguous notation was parsed with certainty.
-   Initial records may contain values such as `70 / 4x12` and
    `10x80 8x90 11x100`; parser must support configurable patterns and
    manual correction.

#### F15. Routine versioning and exercise alternatives --- P1, M

-   Suggest user-defined alternatives and preserve routine history; no
    automatic programming or claims that two exercises are equivalent.

#### F16. Desktop analysis view --- P1, M

-   Wider charts, table view, filtering, keyboard shortcuts, batch edits
    and export.

### Future features

-   Optional encrypted sync between devices.
-   Android-native wrapper/client if PWA shortcomings are material.
-   Wear OS integration only if it clearly improves in-workout capture.
-   Importers for other tracker formats.
-   User-defined metrics and advanced data analysis.
-   Cloud backup provider integration.
-   Public release, onboarding for multiple users, localization,
    monetization.
-   AI-generated coaching is explicitly not part of the initial roadmap.

## 10. UI/UX Design Specification

### Design direction

"Quiet precision": premium, editorial, dark-friendly, restrained,
data-rich without looking like a spreadsheet. Avoid the common
fitness-app tropes of neon gradients, excessive badges, confetti, and
social-feed cards.

### Brand personality

Focused, competent, calm, transparent, user-owned.

### Layout and grid

-   Mobile base: 4-column conceptual grid with 16 px page gutters;
    content fills width.
-   Tablet: 8-column grid.
-   Desktop: 12-column grid with a readable max content width around
    1200--1360 px.
-   Main workout content should remain narrow enough for quick scanning;
    analytics may use wider layouts.
-   Use cards only when they group meaningful information; avoid
    excessive nested surfaces.

### Spacing system

Use a 4 px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px. Most
controls should use 8--16 px internal spacing. Maintain generous
separation between exercises and tight grouping within a set.

### Typography

Use a legible system sans-serif stack or a bundled variable font with
good numeral clarity. Numeric weights/reps should use tabular
numerals. - Display/page title: 28--32 px mobile, 32--40 px desktop. -
Section title: 20--24 px. - Card title: 16--18 px. - Body: 14--16 px. -
Secondary metadata: 12--14 px, never too low contrast. - Numeric set
values: 18--24 px where they are the primary interaction.

### Color system

Define semantic tokens rather than hard-coding colors: - Background /
elevated surface / secondary surface. - Primary text / secondary text /
muted text. - Border / divider. - Primary action / focus ring. - Success
/ warning / error. - Chart series with color plus labels or markers, not
color alone.

Exact palette is an open design decision. Proposed starting point:
charcoal/near-black dark theme, warm neutral light theme, one restrained
electric-lime or teal accent. Test legibility and avoid green/red-only
status cues.

### Dark mode

Support system default and explicit light/dark override. Dark mode
should be carefully tuned, not simple color inversion. In-gym primary
path should be readable at low brightness.

### Motion

-   120--200 ms for small transitions.
-   Respect `prefers-reduced-motion`.
-   Completion feedback should be brief and non-blocking.
-   No animated chart entrance that delays interpretation.
-   Avoid moving layout when a set is completed; collapse only if the
    user preference allows it.

### Component philosophy

Reusable components: Button, NumericField, SetRow, ExerciseCard,
LocationPicker, ExerciseSearch, RoutineCard, MetricCard, ChartPanel,
ConfirmDialog, Toast/Undo, EmptyState, ImportPreview, ExportPanel. Use a
small design system and consistent interaction rules. Numeric entry
should not depend on fragile swipe gestures.

### Navigation

Mobile: bottom navigation for Workout, Routines, History, Progress,
Settings. During an active session, Workout remains visually dominant
and the active session is recoverable from every screen. Desktop:
sidebar or top-level navigation plus wider content. Do not force mobile
bottom-nav conventions onto desktop.

### Mobile interactions

-   One-handed reachability for primary actions.
-   Large numeric input hit areas.
-   Next/previous set flow and keyboard numeric keypad.
-   Preserve cursor and field values during state updates.
-   Haptic feedback only if supported and subtle.
-   No mandatory long-press gestures.
-   Confirmation for destructive bulk actions; undo for common
    accidental actions.

### Desktop interactions

-   Keyboard navigation and shortcuts for adding sets, moving between
    fields, and search.
-   Multi-column history and analytics.
-   Editable tables only where they improve efficiency.
-   Hover states are enhancements, never the only way to discover
    actions.

### Empty, loading, and error states

-   Empty states explain the next useful action.
-   Initial shell should show quickly; use skeletons only for genuinely
    delayed work.
-   Local-first actions should not show fake network spinners.
-   Error copy must say what happened and what the user can do next.
-   Never show "saved to cloud" unless a verified sync actually
    occurred.

### Screen-by-screen specification

#### A. Workout home

-   **Layout:** title and current/last location; primary "Start
    workout"; active-session resume card if applicable; recent sessions;
    quick access to routines.
-   **Interactions:** start blank, start routine, resume active session,
    change location.
-   **Hierarchy:** active workout \> start action \> recent activity.
-   **Mobile:** one primary CTA above the fold.
-   **Desktop:** add weekly summary beside recent sessions.

#### B. Active workout

-   **Layout:** compact header with elapsed time and location; exercise
    list; persistent finish action; optional rest timer strip.
-   **Exercise card:** exercise name, planned-vs-performed label if
    substituted, previous performance, set rows, add-set action,
    replace/reorder/skip menu.
-   **Set row:** set number/type, weight field, reps field, completion
    control, optional RPE/RIR.
-   **Interactions:** complete/edit/undo set; add set; reorder exercise;
    substitute; add exercise; change location scope; finish workout.
-   **Behavior:** local autosave after each meaningful edit. Incomplete
    sets remain editable. Finish is not available only after every
    planned exercise is complete.
-   **Mobile:** compact vertical list; no complex side panels.
-   **Desktop:** optional side panel with last performance and exercise
    history.

#### C. Exercise picker

-   Search at top; recent/favorites; filters by equipment/muscle group;
    custom exercise action.
-   Search should remain responsive and preserve the active workout
    behind it.
-   Choosing an exercise returns directly to the workout.

#### D. Replace exercise sheet

-   Clearly states which planned exercise is being replaced.
-   Offers recent alternatives and search.
-   Preserves completed sets and lets the user decide whether to move
    them to the replacement only if data semantics remain valid; default
    is to keep historical sets attached to the exercise actually
    performed.
-   Optionally record a substitution reason such as "occupied," "not
    available," or "preferred alternative."

#### E. Routine list

-   Routine cards show name, planned exercise count, last used date, and
    start action.
-   Create, duplicate, edit, archive.
-   Avoid prescribing fixed weekly schedules in the MVP.

#### F. Routine editor

-   Reorderable exercise list; default set/rep suggestions;
    add/replace/remove; routine notes.
-   Changes to a routine affect future sessions only.
-   Clear "Save routine" action and unsaved-change handling.

#### G. History

-   Reverse-chronological sessions with date, location, routine/focus,
    duration, completed set count.
-   Filters for date, location, routine, and exercise.
-   Incomplete sessions visibly distinguished.
-   Desktop may offer table mode; mobile stays scannable.

#### H. Session detail

-   Session summary, location, timeline/duration, exercises and set
    rows, notes, PRs.
-   Edit past workout; duplicate as a new workout; export session.
-   Editing a historical record must not alter the original timestamp
    silently.

#### I. Progress

-   Exercise selector, date range, location filter, metric selector.
-   Default chart: load/reps by date for one exact exercise and
    location.
-   Distinguish "same exercise at same location" from "across
    locations."
-   Show raw data points and metric definitions.
-   No cross-location aggregate by default.

#### J. Location management

-   List active/archived locations; add/edit/archive.
-   Fields: name, optional notes, optional gym chain/address (address is
    not required), optional equipment/machine notes.
-   Avoid collecting precise location data unless user chooses to enter
    it.
-   Renaming a location should not corrupt old records.

#### K. Export/import and backup

-   Export all JSON; export normalized CSV; export current session.
-   Import preview with record counts, warnings, and duplicate policy.
-   Explain local storage versus backup.
-   Display last successful export only if the app can know it.
-   Offer browser/Android share or save flow where supported.

#### L. Settings

-   Units, theme, default location, timer behavior, set defaults,
    analytics options, backup reminders, data management, privacy, app
    version.
-   Destructive reset separated from ordinary settings and requires
    confirmation.

#### M. Desktop dashboard

-   Optional after MVP: recent workouts, training frequency, top PRs,
    trends and filters.
-   Do not prioritize decorative dashboards over the in-gym logging
    flow.

## 11. System Architecture

### Recommendation

Build a **local-first PWA** with a typed TypeScript codebase and
IndexedDB as the primary database. Do not introduce a backend, accounts,
queues, Redis, or a multi-tenant architecture for a single-user tool.

### Suggested stack

-   **Framework:** React + TypeScript.
-   **Build:** Vite.
-   **Routing:** React Router or a similarly lightweight router.
-   **Styling:** CSS variables/design tokens plus Tailwind CSS or CSS
    Modules. Choose one approach; avoid mixing ad hoc systems.
-   **UI primitives:** accessible headless primitives where needed;
    custom workout-specific components.
-   **Forms/validation:** Zod for schema validation; React Hook Form
    only for complex forms, not every numeric field.
-   **Local database:** Dexie over IndexedDB for migrations and queries.
-   **Charts:** Recharts or Visx; choose the simplest library that
    handles responsive, accessible charts.
-   **PWA:** Vite PWA plugin / Workbox for app-shell caching and update
    handling.
-   **Testing:** Vitest, React Testing Library, Playwright for
    end-to-end tests.
-   **Lint/format:** ESLint + Prettier; strict TypeScript.
-   **Hosting:** static hosting such as Cloudflare Pages, Netlify, or
    Vercel. The host serves app assets only; workout data stays on
    device.
-   **CI/CD:** GitHub Actions for typecheck, lint, unit tests, build,
    and smoke tests.
-   **Observability:** privacy-preserving client error logging is
    optional; default to no workout-content telemetry.

### Frontend architecture

Feature-based modules: - `workout/` active session and set logging. -
`routines/` template CRUD. - `exercises/`
catalogue/search/substitution. - `locations/` location CRUD. -
`history/` past sessions. - `analytics/` calculations and charts. -
`data/` schema, repository, import/export, migrations. - `settings/`
preferences and backup. - `ui/` design system.

Keep domain logic out of React components. Define repository interfaces
so IndexedDB can later be replaced or supplemented without rewriting the
workout UI. Use explicit domain services for starting/finishing
sessions, completing sets, substitutions, imports, and analytics.

### Backend architecture

**None in MVP.** A static site host is sufficient. Do not add
server-side storage simply because it is common in SaaS products.

### API strategy

No network API required for core functionality. Define internal service
interfaces and a versioned export schema. If sync is later introduced,
add a small REST API or managed sync service with clear conflict
semantics; do not prematurely build GraphQL.

### Database

IndexedDB stores exercises, locations, routines, sessions, session
exercise instances, sets, preferences, and migration metadata. Use
stable UUIDs. Use transactions for multi-record operations such as
completing/undoing a set or importing a workout.

### Realtime

Not required. UI updates are local. If multiple tabs are supported, use
BroadcastChannel or storage coordination to warn about simultaneous
editing; do not silently overwrite.

### Auth

None. Device/browser profile is the trust boundary. Explain that
clearing browser storage or losing the device can lose data without an
export/backup.

### File storage

Use browser file download, file input, and Android share/save
affordances where supported. Do not rely on a proprietary cloud file
store.

### Search

For a personal exercise catalogue, indexed local search is enough. Use
normalized lowercase tokens and aliases; no external search service.

### Queues/events/cache/CDN

-   Queue: none.
-   App-shell caching: service worker.
-   Data cache: IndexedDB is the source of truth; in-memory cache is
    optional.
-   CDN: provided by static host for app assets.
-   Rate limiting: not applicable to local operations; hosting provider
    protects static delivery.

### Security

No secrets or sensitive credentials in client code. Treat imports as
untrusted input, validate schema, cap file size, and guard against
malformed data. Avoid rendering imported HTML. Keep all records local
unless the user explicitly exports them.

### Scalability

Not a primary constraint. Architect for clean modules and data
migrations, not hypothetical millions of users. The most important
scaling axis is long-term data integrity and maintainability.

### Observability and analytics

Use local diagnostics and reproducible error reports. Product analytics
are disabled by default; if introduced, opt-in and never send exercise
names, notes, weights, or location names without explicit consent.

### Deployment and updates

Static deployment with preview environments. The service worker must not
interrupt an active workout with a forced reload. Show "update
available" and let the user apply it after the session or save state
before refresh.

### Trade-offs

-   **PWA vs native Android:** PWA is cheaper and easier to iterate;
    native has stronger platform integration and predictable storage
    behavior. Start PWA, evaluate real usage before switching.
-   **Local-first vs cloud-first:** local-first improves privacy,
    offline use, and cost; backup responsibility is more visible and
    multi-device sync is harder.
-   **IndexedDB vs localStorage:** IndexedDB is appropriate for
    structured data and larger histories; localStorage is only for tiny
    preferences.
-   **No backend vs managed sync:** no backend sharply reduces
    complexity; sync can be added later with a deliberate conflict
    model.

## 12. Database Schema Design

### Core modeling rule

A **performed set** is the canonical unit of training data. Routines
describe intended sessions; session records describe what actually
happened. Historical sets must remain interpretable even if names or
templates change.

### Example logical schema

#### `Exercise`

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `id`                    UUID                    Stable ID

  `name`                  string                  Canonical display name

  `aliases`               string\[\]              Search aliases

  `equipmentType`         enum/string             Machine, dumbbell,
                                                  barbell, cable,
                                                  bodyweight, other

  `movementPattern`       optional string         Push, pull, squat,
                                                  hinge, isolation, etc.

  `muscleTags`            string\[\]              Optional classification

  `isCustom`              boolean                 User-created exercise

  `archivedAt`            nullable timestamp      Prefer archive to hard
                                                  delete

  `createdAt`,            timestamps              Audit metadata
  `updatedAt`                                     
  -----------------------------------------------------------------------

#### `Location`

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `id`                    UUID                    Stable ID

  `name`                  string                  User-defined
                                                  gym/location name

  `notes`                 optional string         Equipment differences,
                                                  setup notes

  `address`               optional string         Avoid requiring exact
                                                  address

  `archivedAt`            nullable timestamp      Historical references
                                                  remain valid

  `createdAt`,            timestamps              
  `updatedAt`                                     
  -----------------------------------------------------------------------

#### `Routine`

  Field                      Type                 Notes
  -------------------------- -------------------- ------------------------------
  `id`                       UUID                 Stable ID
  `name`                     string               User-defined
  `notes`                    optional string      
  `exerciseOrder`            string\[\]           Ordered routine-exercise IDs
  `createdAt`, `updatedAt`   timestamps           
  `archivedAt`               nullable timestamp   

#### `RoutineExercise`

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `id`                    UUID                    Stable ID

  `routineId`             UUID                    Parent routine

  `exerciseId`            UUID                    Planned exercise

  `position`              integer                 Order

  `suggestedSets`         integer/null            Defaults only

  `targetRepMin`,         integer/null            Suggestions, not
  `targetRepMax`                                  restrictions

  `notes`                 optional string         
  -----------------------------------------------------------------------

#### `WorkoutSession`

  ------------------------------------------------------------------------
  Field                    Type                    Notes
  ------------------------ ----------------------- -----------------------
  `id`                     UUID                    Stable ID

  `routineId`              UUID/null               Template source, if any

  `routineNameSnapshot`    string/null             Historical display

  `locationId`             UUID/null               Default session
                                                   location

  `locationNameSnapshot`   string/null             Historical display
                                                   fallback

  `startedAt`, `endedAt`   timestamps/null         Local offset retained
                                                   in ISO timestamp

  `status`                 enum                    active, completed,
                                                   abandoned

  `focus`                  optional string         User-defined focus, not
                                                   a rigid taxonomy

  `notes`                  optional string         

  `createdAt`, `updatedAt` timestamps              
  ------------------------------------------------------------------------

#### `WorkoutExercise`

  Field                     Type              Notes
  ------------------------- ----------------- --------------------------------------------------
  `id`                      UUID              Session-specific instance
  `sessionId`               UUID              Parent session
  `plannedExerciseId`       UUID/null         Original template exercise
  `performedExerciseId`     UUID              Exercise actually performed
  `plannedNameSnapshot`     string/null       Preserve intent
  `performedNameSnapshot`   string            Preserve history
  `position`                integer           Session order
  `status`                  enum              planned, active, completed, skipped, substituted
  `substitutionReason`      optional string   e.g. occupied/not available
  `notes`                   optional string   

#### `SetRecord`

  ------------------------------------------------------------------------
  Field                    Type                    Notes
  ------------------------ ----------------------- -----------------------
  `id`                     UUID                    Stable set ID

  `sessionId`              UUID                    Redundant
                                                   index-friendly parent

  `workoutExerciseId`      UUID                    Parent exercise
                                                   instance

  `setNumber`              integer                 Order within exercise

  `setType`                enum                    warmup, working, drop,
                                                   failure, other

  `weightValue`            number/null             Numeric value as
                                                   entered

  `weightUnit`             enum                    kg or lb; store
                                                   explicitly or normalize
                                                   plus original unit

  `reps`                   integer/null            Actual completed reps

  `isCompleted`            boolean                 Completed vs
                                                   planned/incomplete

  `performedAt`            timestamp/null          Actual set completion
                                                   time

  `locationId`             UUID/null               Location for this set

  `locationNameSnapshot`   string/null             Preserve meaning if
                                                   renamed

  `rpe`                    number/null             Optional, bounded
                                                   validation

  `rir`                    number/null             Optional

  `durationSeconds`        number/null             For timed movements if
                                                   supported

  `distanceValue`          number/null             Future optional field

  `notes`                  optional string         

  `createdAt`, `updatedAt` timestamps              
  ------------------------------------------------------------------------

#### `AppSettings`

Preferences such as units, theme, default location, rest timer, and
backup reminder interval.

#### `SchemaMetadata`

Current schema version, migration state, import/export format versions,
last successful migration.

### Relationships

-   Routine 1---many RoutineExercise.
-   WorkoutSession 1---many WorkoutExercise.
-   WorkoutExercise 1---many SetRecord.
-   Exercise 1---many RoutineExercise and WorkoutExercise.
-   Location 1---many sessions and set records.
-   A set stores its location context explicitly, even if the session
    has a default location.

### Indexing

IndexedDB indexes on: - `WorkoutSession.startedAt`, `status`,
`locationId`. - `WorkoutExercise.sessionId`, `performedExerciseId`,
`position`. - `SetRecord.sessionId`, `workoutExerciseId`, `performedAt`,
`locationId`. - `RoutineExercise.routineId`, `position`. - Exercise
normalized name/aliases where feasible.

### History and audit

Track `createdAt` and `updatedAt`. Full immutable audit history is
unnecessary for a personal MVP; however, imports and edits must not
silently rewrite provenance. Export should include stable IDs and
timestamps. Consider a change log only if undo/history requirements
demand it.

### Multi-tenant considerations

Not applicable. Do not add tenant IDs or user tables in MVP. If
sync/public multi-user support is introduced, add a clear owner boundary
and authorization tests before deployment.

### Data integrity rules

-   Completed set must reference a valid session exercise.
-   Replacing an exercise creates/updates the session-specific performed
    exercise; it never rewrites prior sessions.
-   Archiving an exercise/location does not delete referenced records.
-   Weight and reps can be null for timed/bodyweight or incomplete
    entries, but validation must distinguish missing from zero.
-   Do not infer that a numeric load is comparable across different
    machine/location combinations.

## 13. API Design

No public API is required in MVP. The local domain service layer should
still use explicit typed operations, which can later map to a REST API.

### Example internal operations

-   `POST`-style `startWorkout({ routineId?, locationId?, startedAt })`
-   `addExercise({ sessionId, exerciseId, position, plannedExerciseId? })`
-   `completeSet({ workoutExerciseId, weightValue, weightUnit, reps, setType, locationId, performedAt })`
-   `updateSet({ setId, patch })`
-   `substituteExercise({ workoutExerciseId, performedExerciseId, reason? })`
-   `finishWorkout({ sessionId, endedAt, notes? })`
-   `exportData({ format: "json" | "csv" })`
-   `importData({ file, mode: "merge" | "replace" })`

### Example export JSON

``` json
{
  "format": "gym-tracker-export",
  "formatVersion": 1,
  "exportedAt": "2026-10-13T18:00:00Z",
  "units": { "weight": "kg" },
  "locations": [
    { "id": "loc-uuid", "name": "Gym A", "notes": "Leg press model differs" }
  ],
  "exercises": [
    { "id": "ex-uuid", "name": "Leg press", "aliases": ["Beinpresse"] }
  ],
  "sessions": [
    {
      "id": "session-uuid",
      "startedAt": "2026-10-13T17:00:00+02:00",
      "endedAt": "2026-10-13T18:00:00+02:00",
      "status": "completed",
      "locationId": "loc-uuid",
      "exerciseInstances": [
        {
          "id": "instance-uuid",
          "performedExerciseId": "ex-uuid",
          "sets": [
            {
              "id": "set-uuid",
              "setNumber": 1,
              "setType": "working",
              "weightValue": 60,
              "weightUnit": "kg",
              "reps": 10,
              "isCompleted": true,
              "locationId": "loc-uuid"
            }
          ]
        }
      ]
    }
  ]
}
```

### CSV export

Prefer a normalized `sets.csv` with one row per set, plus
`sessions.csv`, `exercises.csv`, and `locations.csv`. Include stable
IDs, timestamps, units, performed/planned exercise IDs, set type,
completion state, location ID/name snapshot, and optional metadata.
Document column names, enums, units, timestamp rules, and null
semantics. Do not make one giant wide CSV with one column per exercise.

### Authentication and rate limits

None for local operations. If a remote API is added, use short-lived
tokens or secure session cookies, per-user authorization, request
validation, and rate limits at the server edge.

### Webhooks and SDK

Not needed.

### Versioning

Export has `formatVersion`; database schema has a separate migration
version. Support at least the previous export version during import
where practical. Never conflate app version and data schema version.

## 14. Security & Privacy

-   **Authentication:** none in MVP; explain local-device implications.
-   **Authorization:** same-origin application; no user roles.
-   **Encryption:** use HTTPS for app delivery. Browser-managed device
    storage is not equivalent to a separately encrypted vault; do not
    claim otherwise.
-   **Secrets:** no API secrets in frontend bundles.
-   **Data isolation:** workout records remain in browser storage on
    that device/browser profile.
-   **Import safety:** validate types, limits, relationships, and file
    size; treat imported strings as text; never execute imported
    content.
-   **Abuse/fraud:** not applicable for single-user local use.
-   **GDPR:** if the product is used only personally with no server-side
    personal data, obligations differ from a hosted service. If publicly
    offered, provide a privacy notice, lawful basis, data minimization,
    access/export/deletion processes, processor agreements, and a
    documented retention policy as applicable. Obtain qualified legal
    review before commercial launch.
-   **Data minimization:** location name is enough; precise address is
    optional. No GPS collection.
-   **Backup:** manual JSON export is the authoritative MVP backup.
    Explain that browser storage can be cleared or evicted.
-   **Disaster recovery:** restore by importing a valid export; validate
    before replacing current data; preserve a pre-restore export.
-   **Incident response:** if remote sync/telemetry is later added,
    define detection, triage, containment, notification, and recovery
    processes before launch.
-   **Privacy defaults:** no advertising, no third-party trackers, no
    automatic upload of workout data.

## 15. AI/Automation Systems

AI is not required and should not be included in the MVP. Workout
logging, charts, imports, and exports are deterministic tasks. Adding an
LLM would increase privacy risk and complexity without solving the core
pain point.

Possible future automation: - Suggest alternatives based on user-defined
exercise mappings and past usage. - Explain progress charts in plain
language, strictly grounded in local data. - Help clean imported
exercise names with explicit user approval.

If added, the system must not invent missing set values, silently alter
training records, or provide medical claims. Keep all changes
human-approved, show source records for any generated summary, and offer
a non-AI path for every core task.

## 16. Monetization & Business Model

### Personal MVP

-   Free to use.
-   No account, payments, ads, or subscription.
-   Export/import and backup are core trust features, never paywalled.

### If public commercialization is later approved

Potential models: 1. One-time purchase for a premium personal app. 2.
Optional paid sync/backup infrastructure. 3. Paid advanced analytics
only if core history and export remain free. 4. No advertising model: it
conflicts with privacy and focus.

### Economics

At single-user scale, hosting a static PWA is inexpensive. The main cost
is development and ongoing compatibility maintenance. If cloud sync is
added, storage, support, incident response, and privacy compliance
become material costs. CAC/LTV calculations are premature until a public
distribution strategy is chosen.

## 17. Analytics & KPIs

For the personal product, these are product-quality measures, not
necessarily telemetry collected from the user.

### North Star Metric

**Successful sets logged with complete, recoverable context per
workout.** This reflects capture quality better than raw app opens.

### Activation

-   Time from first launch to first saved set.
-   Percentage of new setups completing a first workout.
-   Percentage of workouts with a location assigned.

### Retention

-   Workouts logged per week.
-   Routine reuse rate.
-   Percentage of active workouts resumed successfully after app
    closure.
-   Export/backup completion cadence.

### Data quality

-   Percentage of completed sets with valid weight/reps fields
    appropriate to exercise type.
-   Duplicate exercise rate.
-   Import rows requiring manual correction.
-   Cross-location comparison opt-in rate.

### Operational metrics

-   Crash/error rate.
-   Failed local writes.
-   Session recovery success.
-   PWA update failures.
-   Export/import success.

### Product analytics events

If local-only diagnostics are useful, record locally: -
`workout_started` - `set_completed` - `set_edited` -
`exercise_substituted` - `workout_completed` - `export_completed` -
`import_completed` No event should be transmitted by default. Never
include notes or detailed workout values in remote telemetry without
explicit opt-in.

### Dashboard

An internal developer dashboard is unnecessary for personal MVP. Provide
a user-facing progress dashboard instead.

## 18. Performance Requirements

### Targets

-   First meaningful UI after app shell is cached: under 1 second on a
    mid-range modern Android device as a target.
-   Cold first load on typical broadband: aim for under 2.5 seconds to
    interactive; measure rather than promise.
-   Common local write after set completion: perceived immediate
    response; target under 100 ms.
-   Exercise search: target under 100 ms for a local catalogue of
    several thousand items.
-   Chart interaction: target under 200 ms for ordinary personal
    histories.
-   Avoid large blocking bundles; lazy-load analytics and import/export
    tools if needed.

### Reliability

-   Core logging works offline after initial installation/load.
-   Every meaningful edit is persisted locally promptly.
-   Active workout survives reload/app termination in normal browser
    storage conditions.
-   No guarantee against user-cleared storage, browser eviction, device
    loss, or hardware failure; explain backup behavior.

### Sync behavior

No sync in MVP. If sync is introduced, show explicit
pending/synced/conflict states. Never let a remote version silently
overwrite a local workout.

### Storage

Personal workout records are small, but long-term charts and images (if
any later) should not be allowed to grow without bounds. Do not store
unnecessary images in the database. Warn if local storage writes fail.

### Battery and network

No continuous GPS, polling, or background network traffic. The rest
timer should not require a persistent server connection.

## 19. SEO & Growth Strategy

Not applicable to a private personal app. If public launch becomes a
goal: - Create a concise landing page explaining fast logging,
location-aware history, local-first privacy, and full export. - Provide
an interactive demo or short video of the active workout screen. -
Publish clear documentation for export schema and backup/restore. - SEO
topics could include "offline workout tracker," "export workout data
CSV," and "strength training log without account," but do not generate
thin programmatic pages. - Community/referral/influencer strategies are
optional and should follow evidence of product-market fit. - No social
graph or referral prompt in the personal MVP.

## 20. Development Roadmap

Timeline assumes one capable developer working part-time to full-time,
with design and engineering decisions kept focused. Estimates are
ranges, not commitments.

### Phase 0 --- Discovery and UX validation (3--5 days)

-   Review current Markdown files and map each notation pattern.
-   Test 2--3 existing apps against the user's real workflow.
-   Define data semantics for location, machine comparability, and
    substitutions.
-   Sketch active-workout and set-row interaction.
-   Exit criteria: validated core flow and a clear list of unresolved
    decisions.

### Phase 1 --- Domain model and visual prototype (1 week)

-   Define TypeScript entities and schema version.
-   Prototype workout home, active session, exercise picker, and
    location picker.
-   Test on the actual Samsung phone at realistic screen size.
-   Exit criteria: set entry and substitution feel fast in a clickable
    prototype.

### Phase 2 --- Core local-first MVP (2--4 weeks)

-   IndexedDB/Dexie schema and migrations.
-   Session lifecycle, set entry, location management, routine
    templates, exercise catalogue.
-   PWA install/offline behavior.
-   Exit criteria: user can complete multiple workouts without network
    access or data loss under normal app lifecycle.

### Phase 3 --- History, analytics, and portability (1--2 weeks)

-   History and session detail.
-   Location-filtered exercise charts and basic PRs.
-   JSON/CSV export and safe import framework.
-   Markdown importer for the current format if scope permits.
-   Exit criteria: all core data exports and can be reconstructed; stats
    do not silently mix machine contexts.

### Phase 4 --- Hardening and release to personal use (1 week)

-   Automated tests, accessibility pass, performance checks, storage
    failure handling.
-   Backup/restore drill.
-   Install on Samsung phone and test in airplane mode.
-   Exit criteria: successful end-to-end workout, export, clear app
    data, restore, and verify records.

### Phase 5 --- V1 refinement (ongoing)

-   Rest timer, advanced metadata, desktop analytics, importer
    improvements.
-   Decide whether sync/native Android is justified by observed pain.

### Suggested team

-   MVP: one full-stack/frontend engineer with product/UX capability;
    occasional design review.
-   If a team is available: product/UX designer, frontend engineer, QA
    support.
-   No backend engineer, data scientist, or AI engineer is needed for
    the MVP.

### Critical dependencies

-   Stable data model before advanced analytics.
-   Location semantics before charts.
-   Export schema before importer and backup UX.
-   Active workout state persistence before polish.
-   UI prototype tested on actual device before implementation expands.

## 21. Risks & Failure Modes

  -----------------------------------------------------------------------------------
  Risk              Impact                Likelihood        Mitigation
  ----------------- --------------------- ----------------- -------------------------
  Overengineering   MVP never ships       High              No
  the personal tool                                         backend/auth/AI/social;
                                                            ship the workout loop
                                                            first

  Logging UX is     User returns to       Medium-high       Measure taps/time; test
  slower than       manual notes                            between sets on phone
  expected                                                  

  Browser storage   Major trust failure   Medium            Clear warning, one-tap
  is lost                                                   JSON export, restore
                                                            test, optional reminder

  Machine           Incorrect conclusions High              Location-specific default
  differences                                               series; machine notes;
  create misleading                                         explicit aggregation
  progress charts                                           controls

  Exercise names    Charts become         Medium            Canonical IDs, aliases,
  fragment history  incomplete                              archive semantics, merge
                                                            tool with preview

  Import parser     Corrupted history     Medium-high       Preview every ambiguous
  misreads                                                  mapping; retain original
  compressed                                                source; manual
  notation                                                  corrections

  PWA update        Lost                  Medium            Defer activation; persist
  interrupts active context/frustration                     state; update prompt
  workout                                                   after session

  Excessive         Slow capture          Medium            Progressive disclosure;
  optional fields                                           keep core set row minimal
  clutter logging                                           

  Charts overstate  Loss of trust         Medium            Publish metric
  progress                                                  definitions; show raw
                                                            points; mark estimates

  Project expands   Scope creep           High              Explicitly exclude AI
  into coaching app                                         coaching, social
                                                            features, and
                                                            prescriptive programming

  No cloud sync     Single-device         Medium            Keep repository/domain
  feels limiting    constraint                              layer portable; define
  later                                                     sync as a separate future
                                                            project

  Mobile browser    Feature inconsistency Medium            Test Samsung Internet and
  differences                                               Chrome; use progressive
                                                            enhancement
  -----------------------------------------------------------------------------------

### Failure-mode policy

Data integrity failures are more severe than cosmetic failures. When
uncertain, preserve raw records, expose warnings, and avoid automatic
destructive "fixes." A pretty chart with wrong semantics is worse than a
plain but honest table.

## 22. Final Product Evaluation

### Strengths

-   Narrow, real problem with a clear daily workflow.
-   High potential UX payoff because the current approach is manually
    intensive.
-   Location-aware set records address a genuine comparison problem.
-   Local-first architecture limits operational cost and privacy
    exposure.
-   Open exports create durable value and reduce lock-in.
-   Templates remain flexible, reflecting real gym conditions.

### Weaknesses

-   A bespoke app requires ongoing maintenance and browser testing.
-   Local-first storage requires the user to take backups seriously.
-   PWA behavior may be less predictable than native Android for some
    device integrations.
-   Advanced analytics can become misleading if exercise, equipment, and
    location semantics are underspecified.

### Biggest execution challenges

1.  Make the active-workout interface exceptionally fast.
2.  Design the domain model so substitutions and history remain
    accurate.
3.  Represent location context at set level without making normal
    logging cumbersome.
4.  Import legacy data without silently inventing structure.
5.  Make backup and restore understandable and dependable.

### Probability of success

For personal use, success is plausible if scope remains narrow and the
user validates the logging flow early. The largest risk is not market
competition; it is spending too long building a polished platform before
proving that logging is materially easier than the current workflow. A
public commercial outcome cannot be assessed without user research and
market validation.

### What would make it exceptional

-   A set can be logged in seconds with no lost cursor, accidental
    reset, or unnecessary screen transition.
-   A session can be adapted freely when equipment is unavailable.
-   Progress charts are context-aware and honest about comparability.
-   Every record can be exported in a documented, readable format.
-   The app works offline and recovers active workouts reliably.
-   The UI feels intentionally designed rather than like a generic admin
    dashboard.

### What would cause it to fail

-   The app requires too many taps or text fields per set.
-   It treats a template as a rigid plan.
-   It compares machine loads across gyms without warning.
-   Export is incomplete or proprietary.
-   The project adds accounts, cloud infrastructure, AI, or social
    features before the core logging flow works.

------------------------------------------------------------------------

# Open Decisions Register

These decisions should be discussed before implementation locks in
assumptions.

  ---------------------------------------------------------------------------------
  Decision               Recommended default Why it is open       When to decide
  ---------------------- ------------------- -------------------- -----------------
  PWA vs native Android  PWA first           Native offers better After prototype
                                             platform integration and offline test
                                             but costs more to    
                                             build/maintain       

  Local-only vs cloud    Local-only          Sync creates auth,   Only if
  sync                   initially           conflict, privacy,   multiple-device
                                             and cost complexity  use becomes
                                                                  important

  Storage/backup         IndexedDB +         Browser storage can  Before MVP data
                         JSON/CSV export     be cleared or        implementation
                                             evicted              

  Google Drive           Manual export/share Direct Drive API     Only if manual
  integration            first               requires OAuth,      backup proves too
                                             permissions, and     inconvenient
                                             integration work     

  Gym vs machine         Location required;  Different machines   During data-model
  identity               optional            within one gym may   design
                         machine/equipment   also differ          
                         note initially      materially           

  Location scope         Set-level location, Mid-workout gym      Before workout UI
                         session default     changes need a clear implementation
                                             interaction          

  Units                  Store explicit      Mixed-unit data and  Before schema
                         unit; decide        exports need         freeze
                         whether canonical   consistent semantics 
                         normalization is                         
                         also needed                              

  Exercise catalogue     Small seeded        A large catalogue    MVP scope
                         catalogue + custom  takes time and can   
                         entries             create taxonomy      
                                             disputes             

  Machine comparability  Separate series by  Location alone may   Before analytics
                         location by         not distinguish      implementation
                         default; optional   every machine        
                         machine identifier                       
                         later                                    

  Legacy Markdown import MVP or V1           Importing compact    After sample
                                             notations needs      notation
                                             preview/correction   inventory
                                             UI                   

  Analytics scope        History + load/reps Volume and 1RM       MVP/V1 boundary
                         chart + PRs first   calculations have    
                                             assumptions          

  Design palette/font    Dark-first with     Visual identity      Prototype phase
                         light mode          should be tested on  
                                             device               

  Samsung Internet vs    Test both; target   PWA features can     Before release
  Chrome                 current Chrome      vary by browser      
                         first                                    

  Session deletion/edit  Soft archive for    Full audit history   During schema
  history                entities; editable  may be unnecessary   design
                         workouts with                            
                         timestamps                               

  Timer behavior         Manual/optional     Automatic timers may V1 usability test
                         auto-start          annoy or interrupt   

  Public                 Personal tool, no   No stated goal to    Revisit only if
  release/monetization   monetization        serve other users    goals change
  ---------------------------------------------------------------------------------

## Appendix A --- Acceptance Criteria for MVP Release

The MVP is ready for personal daily use only when all of the following
pass:

1.  Start a blank workout and a routine-based workout.
2.  Create and switch gym locations without losing set data.
3.  Log, edit, undo, and delete a set.
4.  Add, skip, reorder, and substitute exercises during an active
    workout.
5.  Close/reopen the app and recover an active workout.
6.  Complete a workout and inspect its history.
7.  View progress for an exercise at one selected location.
8.  Export full JSON and normalized CSV.
9.  Import an export into a clean app instance and verify entity counts
    and values.
10. Import legacy data with an explicit preview for ambiguous notation.
11. Use the main logging flow in airplane mode after initial load.
12. Use the app on the actual Samsung phone with no horizontal scrolling
    in core screens.
13. Navigate all core actions with accessible labels and visible focus
    states.
14. Verify that deleting/renaming an exercise or location does not
    corrupt historical records.
15. Confirm no workout data is transmitted to a server by default.

## Appendix B --- Data and Analytics Rules

-   Weight is not a universal measure of exercise difficulty across
    different machines.
-   Default progress charts should filter by canonical exercise and
    location; machine identity may become a separate dimension.
-   Do not merge different exercise variants solely because their
    display names are similar.
-   Store raw set values; derive volume, estimated 1RM, and PRs at query
    time or in rebuildable caches.
-   For a basic volume metric, document whether it means load × reps and
    clarify that this is not comparable for all movements.
-   Estimated 1RM must be labeled as an estimate and excluded where the
    formula is inappropriate.
-   Keep original imported text or a source reference during migration
    until the user verifies the import.
-   Store timestamps with timezone offsets where available; also
    preserve a stable UTC instant for sorting if needed.
-   Distinguish zero load, bodyweight-only, assisted load, and unknown
    load. Do not encode all as `0`.

## Appendix C --- Existing Workflow Implications

The supplied training log contains date, location, focus, and one column
per exercise. Entries use multiple notations, including values like
`70 / 4x12`, `10x80 8x90 11x100`, and `2x8x63`. The workout advice notes
emphasize an upper/lower split with a possible mixed day, flexible
exercise choices, relatively few hard sets, and rest between heavier
sets.

Implications for the product: - Import should preserve dates, location
labels, focus labels, and exercise names. - Legacy parsing needs a
preview because the same compact string may encode weight-first or
reps-first notation. - The app should not hard-code the advice as rules;
routines should be user-editable suggestions. - Current location labels
can be migrated into user-created location records. - Historical records
without exact machine identity should remain valid with location-level
context and an optional note that machine identity is unknown.
