# Contributing to Bench Flow

Thank you for helping make a free lab notebook better. Bug reports, protocol corrections, documentation and code are all welcome.

## Getting set up

```bash
npm install
npm run dev
npm test
npm run build
```

Every change should pass `npm test` and `npm run build` before you open a pull request.

## Ground rules

- **Offline first.** IndexedDB is the source of truth. Any feature must work without a network connection, and AI features must degrade gracefully without a key.
- **Privacy.** Never log, store outside the device, or echo back a user's API key. Keep personal data out of URLs.
- **Touch and layout.** Targets are at least 48px tall. Screens must work at phone, tablet and laptop widths.
- **Schema changes.** Add a new Dexie version in `src/db/index.ts`, do not edit old versions, and add a migration test that opens the previous schema and checks existing data.
- **Routes.** Add screens to the registry in `src/app/featureRoutes.tsx`, not to `App.tsx`.
- **Protocols.** When you contribute a protocol, include its authors, license and source, so credit travels with it.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep the change focused. Small pull requests are reviewed faster.
3. Add or update tests for behavior you change.
4. Describe what changed, why, and how you tested it, including the screen sizes you checked.
5. By contributing, you agree that your contribution is licensed under the MIT License.

## Reporting bugs

Open an issue with the steps to reproduce, the device and browser, and what you expected. Do not include API keys, patient data or unpublished results in issues.

Repository: https://github.com/ajealene-spec/Bench-Flow
