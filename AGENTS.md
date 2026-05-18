# Agent Notes

- This is a Wails v2 desktop todo app named `quiet-lists`: Go backend at repo root, Vite/TypeScript/Lit frontend in `frontend/`.
- Entry points: `main.go` configures the Wails window/assets/bindings; `app.go` owns SQLite setup, migrations, and bound app methods.
- Frontend entry is `frontend/src/main.ts`; it defines the `quiet-lists-app` Lit custom element and mounts it into `#app`.
- Styles live in `frontend/src/style.css` and `frontend/src/app.css`. The Lit component renders into light DOM via `createRenderRoot()` so these global styles continue to apply.
- Wails-generated bindings are in `frontend/wailsjs/`. Do not hand-edit them; regenerate via Wails when Go bindings change.
- Build assets are embedded from `frontend/dist` by `//go:embed all:frontend/dist` in `main.go`.
- Wails build output is configured in `wails.json` as `build/bin/quietlists.exe`.

## Common Commands

- Dev app: `wails dev`
- Production build: `wails build`
- Frontend build only: run `npm run build` from `frontend/`
- Frontend dependency install: run `npm install` from `frontend/`

## Data Model

- SQLite driver: `modernc.org/sqlite`.
- Database path: `%AppData%/wails-todo/todos.db` via `os.UserConfigDir()`.
- Tables are created/migrated in `App.openDatabase()` and `App.migrateDatabase()`.
- Public Go methods on `App` are callable from TS through `frontend/wailsjs/go/main/App`.

## Code Style

- Keep backend changes in `app.go` unless startup/window wiring belongs in `main.go`.
- Keep frontend logic in the Lit component unless a feature clearly needs another module.
- Lit templates escape interpolated text by default; avoid `unsafeHTML` for user-provided content.
- With the current TypeScript config (`useDefineForClassFields: true`), declare Lit reactive properties with `declare` and initialize them in the constructor. Do not initialize reactive properties as class fields or Lit updates can stop rendering.
- Preserve the dark frameless desktop UI conventions and Wails drag/no-drag attributes.
