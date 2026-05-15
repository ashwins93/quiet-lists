import './style.css';
import './app.css';

import {
    CreateList,
    CreateTodo,
    DeleteList,
    DeleteTodo,
    GetLists,
    GetTodos,
    RenameList,
    SetTodoCompleted,
} from '../wailsjs/go/main/App';
import {Quit, WindowMinimise} from '../wailsjs/runtime/runtime';

type List = {
    id: number;
    title: string;
    createdAt: string;
    totalTodos: number;
    incompleteTodos: number;
};

type Todo = {
    id: number;
    listId: number;
    title: string;
    completed: boolean;
    createdAt: string;
    completedAt: string;
};

type State = {
    lists: List[];
    todos: Todo[];
    selectedListId: number | null;
    loading: boolean;
    error: string;
};

const state: State = {
    lists: [],
    todos: [],
    selectedListId: null,
    loading: true,
    error: '',
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <main class="shell">
        <header class="titlebar" data-drag>
            <div class="brand">
                <span class="brand-mark"></span>
                <span>Quiet Lists</span>
            </div>
            <div class="window-actions" data-no-drag>
                <button class="window-button" id="minimizeButton" aria-label="Minimize">-</button>
                <button class="window-button close" id="closeButton" aria-label="Close">x</button>
            </div>
        </header>

        <section class="workspace">
            <aside class="sidebar">
                <div class="section-label">Lists</div>
                <div class="lists" id="lists"></div>
                <form class="new-list-form" id="newListForm">
                    <input id="newListInput" maxlength="80" placeholder="New list" autocomplete="off" />
                    <button aria-label="Create list">+</button>
                </form>
            </aside>

            <section class="task-panel">
                <div class="panel-header">
                    <div>
                        <p class="eyebrow">Current list</p>
                        <h1 id="activeTitle">Loading...</h1>
                    </div>
                    <div class="list-actions">
                        <button class="ghost-button" id="renameListButton">Rename</button>
                        <button class="ghost-button danger" id="deleteListButton">Delete</button>
                    </div>
                </div>

                <form class="todo-form" id="todoForm">
                    <input id="todoInput" maxlength="160" placeholder="Add a focused task" autocomplete="off" />
                    <button>Add</button>
                </form>

                <div class="status-line" id="statusLine"></div>
                <div class="todos" id="todos"></div>
            </section>
        </section>
    </main>
`;

const listsEl = document.querySelector<HTMLDivElement>('#lists')!;
const todosEl = document.querySelector<HTMLDivElement>('#todos')!;
const activeTitleEl = document.querySelector<HTMLHeadingElement>('#activeTitle')!;
const statusLineEl = document.querySelector<HTMLDivElement>('#statusLine')!;
const newListForm = document.querySelector<HTMLFormElement>('#newListForm')!;
const newListInput = document.querySelector<HTMLInputElement>('#newListInput')!;
const todoForm = document.querySelector<HTMLFormElement>('#todoForm')!;
const todoInput = document.querySelector<HTMLInputElement>('#todoInput')!;
const renameListButton = document.querySelector<HTMLButtonElement>('#renameListButton')!;
const deleteListButton = document.querySelector<HTMLButtonElement>('#deleteListButton')!;

document.querySelector<HTMLButtonElement>('#minimizeButton')!.addEventListener('click', () => WindowMinimise());
document.querySelector<HTMLButtonElement>('#closeButton')!.addEventListener('click', () => Quit());

newListForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = newListInput.value.trim();
    if (!title) return;

    try {
        const list = await CreateList(title);
        newListInput.value = '';
        state.selectedListId = list.id;
        await refresh();
    } catch (error) {
        showError(error);
    }
});

todoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = todoInput.value.trim();
    if (!title || state.selectedListId === null) return;

    try {
        await CreateTodo(state.selectedListId, title);
        todoInput.value = '';
        await refresh();
    } catch (error) {
        showError(error);
    }
});

renameListButton.addEventListener('click', async () => {
    const active = selectedList();
    if (!active) return;

    const title = window.prompt('Rename list', active.title)?.trim();
    if (!title || title === active.title) return;

    try {
        await RenameList(active.id, title);
        await refresh();
    } catch (error) {
        showError(error);
    }
});

deleteListButton.addEventListener('click', async () => {
    const active = selectedList();
    if (!active) return;
    if (!window.confirm(`Delete "${active.title}" and its tasks?`)) return;

    try {
        await DeleteList(active.id);
        state.selectedListId = null;
        await refresh();
    } catch (error) {
        showError(error);
    }
});

async function refresh() {
    state.error = '';
    state.lists = await GetLists();

    if (!state.selectedListId || !state.lists.some((list) => list.id === state.selectedListId)) {
        state.selectedListId = state.lists[0]?.id ?? null;
    }

    state.todos = state.selectedListId === null ? [] : await GetTodos(state.selectedListId);
    state.loading = false;
    render();
}

function render() {
    renderLists();
    renderTodos();

    const active = selectedList();
    activeTitleEl.textContent = active?.title ?? 'No list';
    todoForm.toggleAttribute('hidden', !active);
    renameListButton.disabled = !active;
    deleteListButton.disabled = state.lists.length <= 1;

    if (state.error) {
        statusLineEl.textContent = state.error;
        statusLineEl.classList.add('error');
        return;
    }

    statusLineEl.classList.remove('error');
    if (!active) {
        statusLineEl.textContent = 'Create a list to start collecting tasks.';
        return;
    }

    const open = state.todos.filter((todo) => !todo.completed).length;
    const done = state.todos.length - open;
    statusLineEl.textContent = `${open} open / ${done} done`;
}

function renderLists() {
    listsEl.innerHTML = '';

    for (const list of state.lists) {
        const button = document.createElement('button');
        button.className = 'list-item';
        button.type = 'button';
        button.toggleAttribute('aria-current', list.id === state.selectedListId);
        button.innerHTML = `
            <span>
                <strong>${escapeHtml(list.title)}</strong>
                <small>${list.incompleteTodos} open</small>
            </span>
            <em>${list.totalTodos}</em>
        `;
        button.addEventListener('click', async () => {
            state.selectedListId = list.id;
            state.todos = await GetTodos(list.id);
            render();
        });
        listsEl.appendChild(button);
    }
}

function renderTodos() {
    todosEl.innerHTML = '';

    if (state.loading) {
        todosEl.innerHTML = `<div class="empty-state">Opening your lists...</div>`;
        return;
    }

    if (state.todos.length === 0) {
        todosEl.innerHTML = `<div class="empty-state">No tasks here. Add one clear next step.</div>`;
        return;
    }

    for (const todo of state.todos) {
        const item = document.createElement('article');
        item.className = 'todo-item';
        item.toggleAttribute('data-completed', todo.completed);
        item.innerHTML = `
            <button class="check" aria-label="Toggle task">${todo.completed ? '&#10003;' : ''}</button>
            <div class="todo-copy">
                <span class="todo-title">${escapeHtml(todo.title)}</span>
                ${todo.completed && todo.completedAt ? `<small>done on ${formatDoneDate(todo.completedAt)}</small>` : ''}
            </div>
            <button class="delete-task" aria-label="Delete task">Delete</button>
        `;

        item.querySelector<HTMLButtonElement>('.check')!.addEventListener('click', async () => {
            await SetTodoCompleted(todo.id, !todo.completed);
            await refresh();
        });
        item.querySelector<HTMLButtonElement>('.delete-task')!.addEventListener('click', async () => {
            await DeleteTodo(todo.id);
            await refresh();
        });
        todosEl.appendChild(item);
    }
}

function selectedList() {
    return state.lists.find((list) => list.id === state.selectedListId);
}

function showError(error: unknown) {
    state.error = error instanceof Error ? error.message : String(error);
    render();
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return entities[char];
    });
}

function formatDoneDate(value: string) {
    const normalised = value.includes('T') ? value : value.replace(' ', 'T');
    const date = new Date(normalised);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

refresh().catch(showError);
