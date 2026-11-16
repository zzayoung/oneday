# OneDay

**OneDay is a personal todo, calendar and notes workspace for desktop and mobile browsers.** It brings tasks, a daily timeline, notes and review into one place, with a privacy-conscious design. [中文说明](README.zh-CN.md)

## What it does

- Capture and organize tasks with status, priority, dates, tags and subtasks.
- Plan a day on a timeline, browse a calendar, and record actual work.
- Write Markdown-style notes and review activity in reports.
- Use responsive layouts and appearance themes on desktop and phone browsers.
- Export and import JSON backups; attachment bytes are not included in the Sites JSON backup and must be saved separately.

## Storage and privacy

The main branch contains a Sites-oriented implementation. Its server API expects platform-provided authenticated identity and D1/R2 bindings. Records are scoped to the authenticated owner; attachments use R2. Authentication and isolation depend on a correctly configured trusted hosting platform, not just this source code. Do not expose the API behind a proxy that allows clients to forge identity headers. Data may be stored on the hosting provider; this is not end-to-end encryption.

A separate local demo adapter uses browser local storage and example data. Local storage is specific to a browser and can be cleared or lost. Neither the local demo nor the Oil UI experiment provides cross-device sync. The Sites backend contains remote storage and conflict handling, but this repository does not provide a turnkey independent sync service. Back up important data and verify your deployment before relying on it.

## Development

Requirements: Node.js 22.13 or newer and npm. Install from the lockfile, then start the development server:

```sh
npm ci
npm run dev
```

Open the loopback URL printed by the server (normally `http://127.0.0.1:5173`). The portable development profile simulates sign-in locally; production authentication and storage require compatible hosting and configuration. For a production build run `npm run build`. The D1 migration is in `drizzle/`; provision bindings and apply migrations on your own platform before deploying. Never commit real credentials, project IDs, or private data.

Core and server tests use Node's test runner. After dependencies are installed, from a shell that expands the paths:

```sh
node --test tests/core.test.cjs tests/lite/*.test.cjs tests/cloud/*.cjs tests/cloud/*.test.mjs
```

Some browser and build scripts additionally require Python and browser tooling. See `tests/` and `tools/` for their individual requirements.

## Branches and history

`main` is the original OneDay interface. `test/oil-ui` is a separate visual experiment based on the same snapshot; it is not merged into main and builds a browser-local static demo. Public history starts with this reviewed snapshot; earlier private Site history is not included. Historical documents may describe earlier deployments and are not a promise of current deployment availability. Historical screenshots have been omitted from this public snapshot.

## Technology

JavaScript, HTML and CSS for the workspace; a Vinext/Cloudflare Worker wrapper and D1/R2-oriented API for the Sites edition. Search terms: personal todo, task manager, daily planner, calendar, notes, privacy, responsive web app.

## License

No project license has been specified. Do not assume permission to reuse or redistribute the project beyond applicable law; third-party components retain their own licenses.

The legacy WorkBuddy table identifiers in this snapshot are generic placeholders. An independent WorkBuddy integration requires mapping them to your own tables; do not use another person's identifiers.
