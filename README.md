# Bench Flow

A free, open digital lab notebook for beginner and advanced researchers. Bench Flow walks you through a protocol one step at a time and keeps your timers, numbers, photos and notes with the experiment they belong to.

It is an offline-first alternative to paid electronic lab notebooks: your data lives in your browser first, and the network is optional.

## Features

- **Guided protocols.** Paste text or upload a PDF; get numbered steps with timers, reagents, cautions and hazards.
- **Timers that survive.** Timers keep running through reloads and device sleep.
- **Records per step.** Measurements, timer runs and notes attach to the step they belong to, with a summary at the end.
- **Calculators.** Dilutions, molarity, percent solutions and master-mix scaling inside the step that needs them.
- **Inventory.** Lots, expiry dates, antibody host species and cross-reactivity warnings.
- **Reports.** A printable report of parameters, data, deviations and reagent lots.
- **Learning help.** Beginner explanations and common mistakes for each step.
- **Accessible.** Light and dark themes, a dyslexia-friendly font, and large touch targets for gloved hands.

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173 (Vite default)
```

Open the app, answer the three welcome questions, and choose whether to load starter protocols or start empty.

To run the checks:

```bash
npm test           # unit and migration tests
npm run build      # type check and production build
```

## Bring your own AI key (optional)

AI features (protocol parsing, troubleshooting and literature suggestions) use the Anthropic API. Paste your own key in **Settings**. Without a key, Bench Flow uses its built-in offline tools.

For local development you can instead set `ANTHROPIC_API_KEY` in a `.env` file (see `.env.example`). This fallback works only in development and is never used on a deployed site.

## Privacy

- Notebook data is stored in your browser's IndexedDB. Nothing is uploaded by default.
- Your API key is stored only on your device, is never synced, and is never written to logs.
- When you use an AI feature, the key is sent only to the app's own `/api` route, which forwards it to Anthropic and does not store it.
- The app has no analytics.

## Deploy to Vercel

Bench Flow is a Vite app with small serverless functions in `api/`.

1. Push the repository to GitHub.
2. In Vercel, choose **Add New > Project** and import the repository.
3. Keep the detected settings: framework **Vite**, build command `npm run build`, output directory `dist`. `vercel.json` already sets these and the single-page-app rewrites.
4. Deploy. No environment variables are required, because each user supplies their own key in Settings.
5. Optional: set `ANTHROPIC_MODEL` to change the model. Do not set `ANTHROPIC_API_KEY` on a public deployment, since the app never uses it there.

To deploy from the command line instead, run `npx vercel` in the project folder and follow the prompts.

## Project layout

- `src/app`: shell, routing registry (`featureRoutes.tsx`), settings, welcome and About pages.
- `src/db`: Dexie schema and per-table helpers. Schema changes go through a new version with a migration test.
- `src/features`: protocol parsing, run mode, timers, calculators, inventory, reports.
- `api/` and `server/`: serverless functions and their shared handlers.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bench Flow is MIT licensed; see [LICENSE](LICENSE).

Source: https://github.com/ajealene-spec/Bench-Flow
