package main

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type App struct {
	ctx   context.Context
	db    *sql.DB
	dbErr error
}

type List struct {
	ID              int64  `json:"id"`
	Title           string `json:"title"`
	CreatedAt       string `json:"createdAt"`
	TotalTodos      int    `json:"totalTodos"`
	IncompleteTodos int    `json:"incompleteTodos"`
}

type Todo struct {
	ID          int64  `json:"id"`
	ListID      int64  `json:"listId"`
	Title       string `json:"title"`
	Completed   bool   `json:"completed"`
	CreatedAt   string `json:"createdAt"`
	CompletedAt string `json:"completedAt"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.dbErr = a.openDatabase()
}

func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		_ = a.db.Close()
	}
}

func (a *App) openDatabase() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}

	appDir := filepath.Join(configDir, "wails-todo")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return err
	}

	db, err := sql.Open("sqlite", filepath.Join(appDir, "todos.db"))
	if err != nil {
		return err
	}

	a.db = db
	if _, err := db.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		return err
	}

	schema := `
CREATE TABLE IF NOT EXISTS lists (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS todos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	list_id INTEGER NOT NULL,
	title TEXT NOT NULL,
	completed INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	completed_at TEXT,
	FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);`
	if _, err := db.Exec(schema); err != nil {
		return err
	}
	if err := a.migrateDatabase(); err != nil {
		return err
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM lists`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		_, err = db.Exec(`INSERT INTO lists (title) VALUES (?)`, "Inbox")
	}
	return err
}

func (a *App) migrateDatabase() error {
	rows, err := a.db.Query(`PRAGMA table_info(todos)`)
	if err != nil {
		return err
	}
	defer rows.Close()

	hasCompletedAt := false
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, pk int
		var defaultValue sql.NullString
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		if name == "completed_at" {
			hasCompletedAt = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if !hasCompletedAt {
		if _, err := a.db.Exec(`ALTER TABLE todos ADD COLUMN completed_at TEXT`); err != nil {
			return err
		}
	}

	_, err = a.db.Exec(`UPDATE todos SET completed_at = created_at WHERE completed = 1 AND completed_at IS NULL`)
	return err
}

func (a *App) ready() error {
	if a.dbErr != nil {
		return a.dbErr
	}
	if a.db == nil {
		return errors.New("database is not ready")
	}
	return nil
}

func cleanTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", errors.New("title is required")
	}
	return title, nil
}

func (a *App) GetLists() ([]List, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
SELECT
	l.id,
	l.title,
	l.created_at,
	COUNT(t.id) AS total_todos,
	COALESCE(SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END), 0) AS incomplete_todos
FROM lists l
LEFT JOIN todos t ON t.list_id = l.id
GROUP BY l.id
ORDER BY l.created_at ASC, l.id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lists := []List{}
	for rows.Next() {
		var list List
		if err := rows.Scan(&list.ID, &list.Title, &list.CreatedAt, &list.TotalTodos, &list.IncompleteTodos); err != nil {
			return nil, err
		}
		lists = append(lists, list)
	}
	return lists, rows.Err()
}

func (a *App) CreateList(title string) (List, error) {
	if err := a.ready(); err != nil {
		return List{}, err
	}
	title, err := cleanTitle(title)
	if err != nil {
		return List{}, err
	}

	result, err := a.db.Exec(`INSERT INTO lists (title) VALUES (?)`, title)
	if err != nil {
		return List{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return List{}, err
	}
	return a.getList(id)
}

func (a *App) RenameList(id int64, title string) (List, error) {
	if err := a.ready(); err != nil {
		return List{}, err
	}
	title, err := cleanTitle(title)
	if err != nil {
		return List{}, err
	}
	if _, err := a.db.Exec(`UPDATE lists SET title = ? WHERE id = ?`, title, id); err != nil {
		return List{}, err
	}
	return a.getList(id)
}

func (a *App) DeleteList(id int64) error {
	if err := a.ready(); err != nil {
		return err
	}

	var count int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM lists`).Scan(&count); err != nil {
		return err
	}
	if count <= 1 {
		return errors.New("keep at least one list")
	}

	_, err := a.db.Exec(`DELETE FROM lists WHERE id = ?`, id)
	return err
}

func (a *App) getList(id int64) (List, error) {
	var list List
	err := a.db.QueryRow(`
SELECT
	l.id,
	l.title,
	l.created_at,
	COUNT(t.id),
	COALESCE(SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END), 0)
FROM lists l
LEFT JOIN todos t ON t.list_id = l.id
WHERE l.id = ?
GROUP BY l.id`, id).Scan(&list.ID, &list.Title, &list.CreatedAt, &list.TotalTodos, &list.IncompleteTodos)
	return list, err
}

func (a *App) GetTodos(listID int64) ([]Todo, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}

	rows, err := a.db.Query(`
SELECT id, list_id, title, completed = 1, created_at, COALESCE(completed_at, '')
FROM todos
WHERE list_id = ?
ORDER BY completed ASC, created_at ASC, id ASC`, listID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	todos := []Todo{}
	for rows.Next() {
		var todo Todo
		if err := rows.Scan(&todo.ID, &todo.ListID, &todo.Title, &todo.Completed, &todo.CreatedAt, &todo.CompletedAt); err != nil {
			return nil, err
		}
		todos = append(todos, todo)
	}
	return todos, rows.Err()
}

func (a *App) CreateTodo(listID int64, title string) (Todo, error) {
	if err := a.ready(); err != nil {
		return Todo{}, err
	}
	title, err := cleanTitle(title)
	if err != nil {
		return Todo{}, err
	}

	result, err := a.db.Exec(`INSERT INTO todos (list_id, title) VALUES (?, ?)`, listID, title)
	if err != nil {
		return Todo{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Todo{}, err
	}
	return a.getTodo(id)
}

func (a *App) SetTodoCompleted(id int64, completed bool) (Todo, error) {
	if err := a.ready(); err != nil {
		return Todo{}, err
	}

	value := 0
	if completed {
		value = 1
	}
	completedAt := sql.NullString{}
	if completed {
		completedAt = sql.NullString{String: nowSQLite(), Valid: true}
	}
	if _, err := a.db.Exec(`UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?`, value, completedAt, id); err != nil {
		return Todo{}, err
	}
	return a.getTodo(id)
}

func (a *App) DeleteTodo(id int64) error {
	if err := a.ready(); err != nil {
		return err
	}
	_, err := a.db.Exec(`DELETE FROM todos WHERE id = ?`, id)
	return err
}

func (a *App) getTodo(id int64) (Todo, error) {
	var todo Todo
	err := a.db.QueryRow(`
SELECT id, list_id, title, completed = 1, created_at, COALESCE(completed_at, '')
FROM todos
WHERE id = ?`, id).Scan(&todo.ID, &todo.ListID, &todo.Title, &todo.Completed, &todo.CreatedAt, &todo.CompletedAt)
	return todo, err
}

func nowSQLite() string {
	return time.Now().Format("2006-01-02 15:04:05")
}
