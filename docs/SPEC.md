# Bench Flow — Product Spec (v0.2, 2026-10-26)

## Who / where
- Single user (personal tool), neuroscience + molecular biology labs.
- Uses laptop, iPad and phone interchangeably; lab Wi-Fi is unreliable.

## Platform & stack
- Installable web app (PWA): React + TypeScript + Vite, Tailwind.
- Offline-first: IndexedDB (Dexie) as local source of truth; service worker caches the app.
- Sync: Supabase (later), background sync when online.
- AI: Claude API via a server function, so the key never ships to the browser. Every AI feature degrades gracefully offline / without a key.

## Core concepts
- **Protocol template** — a reusable, editable step-by-step procedure (e.g., "Western Blot"), made by pasting text or uploading a PDF. Lives in the **Protocol Library**, organized by category.
- **Experiment (run)** — one titled execution of a template, with date started/ended, notes, folder, and all recorded data. Starting a run snapshots the template's steps, so editing a template never changes past runs.
- Everything (templates, experiments, folders, records) can be **deleted** (with confirm).

## Core workflow & organization
1. **Template engine** — paste raw text or a PDF → parsed into an interactive, editable template (steps, timers, reagents, data fields, cautions, hazards, calculations).
2. **Protocol library** — templates grouped by category (Western Blot, PCR, IHC, …). Pick one → "Start experiment" → name the run.
3. **Active run workspace** — step-by-step execution with timers, calculators, data entry and notes.
4. **Report generation** — on finish, compile steps, notes, exact parameters, recorded numbers/times, deviations and reagent lots into a report (print/PDF + CSV).

## Bench tools
- **Dynamic calculators** — detect steps that need a calculation (dilution C1V1, molarity/mass, % w/v, serial dilution, master-mix scaling by sample count); show an inline calculator in that step; results saved to the run.
- **Integrated timers** — tied to steps, survive reload/sleep, alarm + notification. (Done.)

## AI-driven features (online + key; always optional)
- **Hazard flagging** — on parse, identify hazardous chemicals/biological agents (rule list + AI). Generate a **mandatory safety/PPE checklist** at the top of the run; all items must be checked before step 1 unlocks.
- **Reagent & antibody tracking** — extract reagent/antibody names, concentrations, dilutions; user adds lot numbers and expiry. Inventory page flags expiring/expired items; warn of possible secondary-antibody cross-reactivity (host species mismatch).
- **Troubleshooting & optimization** — the user records a poor result (e.g., "high background"); the AI suggests adjustments based on the exact parameters used in that run.
- **Literature cross-reference** — after a protocol is imported, ask: "Check recent literature for optimizations?" with **Yes / No thanks** (and "Don't ask again"). Yes → AI summary of suggested updates with citations; nothing is applied without approval.

## Build order
1. **Done:** workspace, import, guided run, timers, resume, offline, experiments + folders + notes + dates.
2. **In progress:** PDF parsing fix, per-step number/timer recording + summary.
3. **Next:** delete everything; protocol library (templates vs experiments); hazard/PPE checklist gate.
4. Calculators; report generation/export.
5. Reagent & antibody inventory; troubleshooting; literature cross-reference.
6. Later: sync across devices, voice, photos.

## Workstreams (subagents, Haiku)
| Agent | Owns |
|---|---|
| architect | Data model, Dexie schema/migrations, routing, library + workspace UI |
| procedure-parser | PDF/text parsing, AI prompts, hazard + reagent extraction |
| run-mode | Step UI, timers, resume, safety checklist gate |
| data-capture | Per-step numbers/timers, summary |
| assistants | Calculators, troubleshooting, literature, Ask-AI |
| outputs | Reports, exports, graphs |
| sync | Supabase (later) |
| qa | End-to-end tests on phone/iPad/laptop, offline |
