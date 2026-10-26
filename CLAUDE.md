# Lab Companion

Personal offline-first PWA that walks through lab procedures step by step. Full spec: docs/SPEC.md. Decisions log: docs/DECISIONS.md.

## Stack
React + TypeScript + Vite, Tailwind, Dexie (IndexedDB), Supabase sync, Claude API via server function.

## Rules
- Project lives outside iCloud (Downloads/Lab App Final/Lab app). Don't move it into a synced folder.
- Offline-first: IndexedDB is the source of truth; network is optional.
- UI must work at phone, iPad and laptop widths with gloved-hand touch targets (min 48px).
- Build in phase order from docs/SPEC.md; don't start a later phase early.
- Subagents in .claude/agents/ each own one area; don't edit another agent's area without coordinating via the project manager.
