import './style.css';
import './app.css';

import {html, LitElement, nothing} from 'lit';

import {
    CreateList,
    CreateTodo,
    DeleteList,
    DeleteTodo,
    GetLists,
    GetTodos,
    RenameList,
    SetTodoCompleted,
    UpdateTodoTitle,
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

class QuietListsApp extends LitElement {
    static properties = {
        lists: {state: true},
        todos: {state: true},
        selectedListId: {state: true},
        loading: {state: true},
        error: {state: true},
    };

    private declare lists: List[];
    private declare todos: Todo[];
    private declare selectedListId: number | null;
    private declare loading: boolean;
    private declare error: string;

    constructor() {
        super();
        this.lists = [];
        this.todos = [];
        this.selectedListId = null;
        this.loading = true;
        this.error = '';
    }

    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.refresh().catch(this.showError);
    }

    render() {
        const active = this.selectedList();

        return html`
            <main class="shell">
                <header class="titlebar" data-drag>
                    <div class="brand">
                        <span class="brand-mark"></span>
                        <span>Quiet Lists</span>
                    </div>
                    <div class="window-actions" data-no-drag>
                        <button class="window-button" aria-label="Minimize" @click=${WindowMinimise}>-</button>
                        <button class="window-button close" aria-label="Close" @click=${Quit}>x</button>
                    </div>
                </header>

                <section class="workspace">
                    <aside class="sidebar">
                        <div class="section-label">Lists</div>
                        <div class="lists">
                            ${this.lists.map((list) => this.renderList(list))}
                        </div>
                        <form class="new-list-form" @submit=${this.createList}>
                            <input
                                id="newListInput"
                                maxlength="80"
                                placeholder="New list"
                                autocomplete="off"
                            />
                            <button aria-label="Create list">+</button>
                        </form>
                    </aside>

                    <section class="task-panel">
                        <div class="panel-header">
                            <div>
                                <p class="eyebrow">Current list</p>
                                <h1>${this.loading ? 'Loading...' : active?.title ?? 'No list'}</h1>
                            </div>
                            <div class="list-actions">
                                <button
                                    class="ghost-button"
                                    ?disabled=${!active}
                                    @click=${this.renameList}
                                >
                                    Rename
                                </button>
                                <button
                                    class="ghost-button danger"
                                    ?disabled=${this.lists.length <= 1}
                                    @click=${this.deleteList}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        ${active ? this.renderProgress(this.completedTodos(), this.todos.length) : nothing}
                        <div class=${this.error ? 'status-line error' : 'status-line'}>${this.statusText()}</div>
                        <div class="todos">
                            ${this.renderTodos(active)}
                        </div>
                    </section>
                </section>
            </main>
        `;
    }

    private renderList(list: List) {
        return html`
            <button
                class="list-item"
                type="button"
                aria-current=${list.id === this.selectedListId ? 'true' : nothing}
                @click=${() => this.selectList(list.id)}
            >
                <span class="list-row">
                    <span class="list-copy">
                        <strong>${list.title}</strong>
                        <small>${list.incompleteTodos} open</small>
                    </span>
                    <em>${list.totalTodos}</em>
                </span>
                ${this.renderProgress(list.totalTodos - list.incompleteTodos, list.totalTodos, true)}
            </button>
        `;
    }

    private renderProgress(completed: number, total: number, compact = false) {
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        return html`
            <div
                class=${compact ? 'progress progress-compact' : 'progress'}
                aria-label=${`${completed} of ${total} tasks complete`}
            >
                <div class="progress-track">
                    <span class="progress-fill" style=${`width: ${percent}%`}></span>
                </div>
                <div class="progress-copy">
                    <strong>${percent}%</strong>
                    <span>${completed}/${total}</span>
                </div>
            </div>
        `;
    }

    private renderTodos(active: List | undefined) {
        if (!active) {
            return html`<div class="empty-state">Create a list to start collecting tasks.</div>`;
        }

        if (this.loading) {
            return html`<div class="empty-state">Opening your lists...</div>`;
        }

        return html`
            <div class="todo-document" @paste=${this.pastePlainText}>
                ${this.todos.map((todo, index) => this.renderTodo(todo, index))}
                ${this.renderDraftTodo()}
            </div>
        `;
    }

    private renderTodo(todo: Todo, index: number) {
        return html`
            <article class="todo-item" ?data-completed=${todo.completed}>
                <button class="check" aria-label="Toggle task" @click=${() => this.toggleTodo(todo)}>
                    ${todo.completed ? html`&#10003;` : nothing}
                </button>
                <div class="todo-copy">
                    <div
                        class="todo-title editable-title"
                        contenteditable="true"
                        role="textbox"
                        spellcheck="true"
                        data-editor
                        data-index=${index}
                        data-placeholder="Untitled task"
                        @keydown=${(event: KeyboardEvent) => this.handleTodoKeydown(event, todo, index)}
                        @blur=${(event: FocusEvent) => this.commitTodoTitle(event, todo)}
                    >${todo.title}</div>
                    ${todo.completed && todo.completedAt
                        ? html`<small>done on ${this.formatDoneDate(todo.completedAt)}</small>`
                        : nothing}
                </div>
                <button class="delete-task" aria-label="Delete task" @click=${() => this.deleteTodo(todo.id)}>
                    Delete
                </button>
            </article>
        `;
    }

    private renderDraftTodo() {
        return html`
            <article class="todo-item draft-item">
                <span class="check check-ghost" aria-hidden="true"></span>
                <div
                    class="todo-title editable-title draft-title"
                    contenteditable="true"
                    role="textbox"
                    spellcheck="true"
                    data-draft-editor
                    data-placeholder=${this.todos.length === 0 ? 'Type your first task...' : 'Type another task...'}
                    @keydown=${this.handleDraftKeydown}
                    @blur=${this.createTodoFromEditor}
                ></div>
            </article>
        `;
    }

    private statusText() {
        if (this.error) return this.error;
        if (this.loading) return '';

        const active = this.selectedList();
        if (!active) return 'Create a list to start collecting tasks.';

        const done = this.completedTodos();
        const open = this.todos.length - done;
        return `${open} open / ${done} done`;
    }

    private createList = async (event: SubmitEvent) => {
        event.preventDefault();
        const input = this.formInput(event, '#newListInput');
        const title = input.value.trim();
        if (!title) return;

        try {
            const list = await CreateList(title);
            input.value = '';
            this.selectedListId = list.id;
            await this.refresh();
        } catch (error) {
            this.showError(error);
        }
    };

    private renameList = async () => {
        const active = this.selectedList();
        if (!active) return;

        const title = window.prompt('Rename list', active.title)?.trim();
        if (!title || title === active.title) return;

        try {
            await RenameList(active.id, title);
            await this.refresh();
        } catch (error) {
            this.showError(error);
        }
    };

    private deleteList = async () => {
        const active = this.selectedList();
        if (!active) return;
        if (!window.confirm(`Delete "${active.title}" and its tasks?`)) return;

        try {
            await DeleteList(active.id);
            this.selectedListId = null;
            await this.refresh();
        } catch (error) {
            this.showError(error);
        }
    };

    private async selectList(listId: number) {
        this.selectedListId = listId;
        this.todos = await GetTodos(listId);
    }

    private async toggleTodo(todo: Todo) {
        try {
            await SetTodoCompleted(todo.id, !todo.completed);
            await this.refresh();
        } catch (error) {
            this.showError(error);
        }
    }

    private async commitTodoTitle(event: FocusEvent, todo: Todo) {
        const editor = event.currentTarget as HTMLElement;
        const title = this.editorText(editor);

        if (!title) {
            editor.textContent = todo.title;
            return;
        }
        if (title === todo.title) return;

        try {
            await UpdateTodoTitle(todo.id, title);
            await this.refresh();
        } catch (error) {
            editor.textContent = todo.title;
            this.showError(error);
        }
    }

    private createTodoFromEditor = async (event: FocusEvent | KeyboardEvent) => {
        const editor = event.currentTarget as HTMLElement;
        const title = this.editorText(editor);
        if (!title || this.selectedListId === null) return;

        try {
            await CreateTodo(this.selectedListId, title);
            editor.textContent = '';
            await this.refresh();
        } catch (error) {
            this.showError(error);
        }
    };

    private handleTodoKeydown = async (event: KeyboardEvent, todo: Todo, index: number) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await this.commitTodoTitle(event as unknown as FocusEvent, todo);
            await this.focusEditor(index + 1);
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            (event.currentTarget as HTMLElement).textContent = todo.title;
            (event.currentTarget as HTMLElement).blur();
        }
    };

    private handleDraftKeydown = async (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        await this.createTodoFromEditor(event);
        await this.focusDraftEditor();
    };

    private async focusEditor(index: number) {
        await this.updateComplete;
        const next = this.querySelector<HTMLElement>(`[data-editor][data-index="${index}"]`);
        if (next) {
            this.focusEditable(next);
            return;
        }
        await this.focusDraftEditor();
    }

    private async focusDraftEditor() {
        await this.updateComplete;
        const draft = this.querySelector<HTMLElement>('[data-draft-editor]');
        if (draft) this.focusEditable(draft);
    }

    private focusEditable(editor: HTMLElement) {
        editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    private pastePlainText = (event: ClipboardEvent) => {
        if (!(event.target instanceof HTMLElement) || !event.target.matches('[contenteditable="true"]')) {
            return;
        }

        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain').replace(/\s+/g, ' ').slice(0, 160) ?? '';
        document.execCommand('insertText', false, text);
    };

    private async deleteTodo(todoId: number) {
        try {
            await DeleteTodo(todoId);
            await this.refresh();
        } catch (error) {
            this.showError(error);
        }
    }

    private async refresh() {
        this.error = '';
        this.lists = await GetLists();

        if (!this.selectedListId || !this.lists.some((list) => list.id === this.selectedListId)) {
            this.selectedListId = this.lists[0]?.id ?? null;
        }

        this.todos = this.selectedListId === null ? [] : await GetTodos(this.selectedListId);
        this.loading = false;
    }

    private selectedList() {
        return this.lists.find((list) => list.id === this.selectedListId);
    }

    private completedTodos() {
        return this.todos.filter((todo) => todo.completed).length;
    }

    private showError = (error: unknown) => {
        this.error = error instanceof Error ? error.message : String(error);
    };

    private formInput(event: SubmitEvent, selector: string) {
        return (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>(selector)!;
    }

    private editorText(editor: HTMLElement) {
        return (editor.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    }

    private formatDoneDate(value: string) {
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
}

customElements.define('quiet-lists-app', QuietListsApp);

document.querySelector<HTMLDivElement>('#app')!.innerHTML = '<quiet-lists-app></quiet-lists-app>';
