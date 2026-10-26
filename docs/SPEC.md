# Lab Companion — Product Spec (v0.1)

## Who / where
- Single user (personal tool), neuroscience + molecular biology labs.
- Uses laptop, iPad and phone interchangeably; lab Wi-Fi is unreliable.

## Platform & stack
- Installable web app (PWA): React + TypeScript + Vite, Tailwind.
- Offline-first: IndexedDB (Dexie) as local source of truth; service worker caches the app.
- Sync: Supabase (auth + Postgres + storage for photos/files), background sync when online.
- AI: Claude API (claude-sonnet-5-5) via a small server function, so the key never ships to the browser.

## Core flows
1. **Workspace** — list of all labs (status: draft / in progress / done, last step, last opened). Tap to resume.
2. **Import procedure** — paste numbered text, upload a PDF lab manual, or paste messy notes. AI parses into structured steps:
   `{ title, instructions, duration?, timers[], reagents[], dataFields[], cautions[] }`. You review/edit before starting.
3. **Guided run mode** — one step at a time, large touch targets for gloved hands.
   - Auto-detected timers (multiple concurrent, survive navigation/reload, alarm + notification).
   - Calculators: dilution (C1V1), molarity/mass, reagent scaling by sample count, unit conversion.
   - Voice: read step aloud; "next", "back", "start timer", "repeat".
   - "Ask about this step" AI panel with procedure context.
4. **Data capture** at any step: typed measurements (from parsed dataFields), instrument file import (CSV/XLSX), photos (camera), free-text observations/deviations — all timestamped to the step.
5. **Resume exactly** — reopen on the current step with running timers and partial data restored, on any device.
6. **Outputs** — auto graphs from imported/typed data; notebook-style PDF (dated, per-step timestamps, deviations, photos, graphs).

## Build phases
- **Phase 1 (MVP):** workspace, paste/PDF/notes → AI parsing → review, guided run mode, timers, exact resume, offline local storage.
- **Phase 2:** data capture (fields, CSV/XLSX import, photos, notes), Supabase sync + sign-in.
- **Phase 3:** calculators, voice control, Ask-AI panel.
- **Phase 4:** auto graphs, notebook PDF export.

## Workstreams (subagents)
| Agent | Owns |
|---|---|
| Architect / scaffold | Repo setup, PWA shell, data model, Dexie schema, routing |
| Procedure parser | Claude prompt + schema, PDF text extraction, review/edit UI |
| Run mode | Step UI, timers engine, resume state |
| Data capture | Fields, file import, photos, notes |
| Sync | Supabase auth, offline queue, conflict handling |
| Assistants | Calculators, voice, Ask-AI |
| Outputs | Graphs, PDF notebook |
| QA | Tests and offline/resume scenarios on each device size |

## Open questions
- Any PDFs that are scanned images (need OCR)?
- Preferred PDF notebook layout (e.g., matching a course template)?
