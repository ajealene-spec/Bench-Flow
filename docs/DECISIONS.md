# Decisions (2026-10-25)

| Topic | Decision |
|---|---|
| Users | Just me |
| Devices | Laptop, iPad, phone (mixed) |
| Delivery | Installable web app (PWA) |
| Sync | Cloud account (Supabase) |
| Offline | Must work reliably offline |
| Procedure input | Numbered text, PDF lab manuals, messy notes |
| Data | Typed measurements, instrument CSV/XLSX, photos, notes |
| Step help | Timers, calculators, voice, Ask-AI |
| Resume | Exact step + running timers + partial data |
| Outputs | Auto graphs, notebook-style PDF |
| Field | Neuroscience, biology/molecular |
| MVP | Paste → guided steps first |
| Subagent models | Haiku (most token-efficient) by default |

## Open
- Scanned (image) PDFs needing OCR?
- Required notebook PDF template?

# Changes (2026-10-26)

| Topic | Decision |
|---|---|
| Naming | "Labs" are now **Experiments** everywhere in the UI, code and routes |
| Experiment fields | Name (editable), date started, date ended, notes, folder |
| Organization | Experiments can be sorted into folders |
| Per-step data | Each step has an entry area for numbers (value + unit + label) and timer records (actual start/stop/elapsed) |
| Summary | When an experiment is done, one page shows every number and timer recorded, by step |
| PDF import | PDFs must produce real procedure steps (e.g., Thermo Fisher Western blot), not random sentences; AI parsing is the primary path for PDFs |
