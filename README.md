# Wails Todo

A small Wails desktop todo app with multiple lists, a frameless dark UI, and SQLite persistence.

## Development

```powershell
wails dev
```

## Build

```powershell
wails build
```

The built executable is written to `build\bin\wails-todo.exe`.

## Storage

On startup the app creates the database and tables if they do not exist. Data is stored at:

```text
%AppData%\wails-todo\todos.db
```
