const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentTab = 'notes';
let currentBoardHash = '';
const API = '/notes';
const BOARDS_API = '/api/boards';

// ====== ЯЗЫК ======
const telegramLang = tg.initDataUnsafe?.user?.language_code;

let currentLang =
    localStorage.getItem('tgnotion_lang') ||
    (telegramLang?.startsWith('ru') ? 'ru' : 'en');

const translations = {
    ru: {
        notes: 'Заметки',
        tasks: 'Задачи',
        boards: 'Доски',
        noNotes: 'Нет заметок',
        noTasks: 'Нет задач',
        noBoards: 'Нет досок',
        save: 'Сохранить',
        cancel: 'Отмена',
        delete: 'Удалить',
        edit: 'Редактировать',
        back: '← Назад',
        share: 'Поделиться',
        add: 'Добавить',
        remind: 'Напомнить',
        newNote: 'Название заметки',
        noteContent: 'Содержимое',
        newTask: 'Название задачи',
        newBoard: 'Новая доска',
        boardTitle: 'Название доски',
        boardType: 'Тип доски:',
        loading: 'Загрузка...',
        empty: '(пусто)',
        create: 'Создать',
        remindWhen: 'Когда напомнить?',
        pickDateTime: '📅 Выбрать дату и время',
        boardCreated: '✅ Доска создана!',
        shareHint: 'Нажми «Поделиться» чтобы отправить доску в чат',
        author: 'Автор',
        sharedBoard: 'Общая доска',
        guest: 'гость',
        unknown: 'неизвестный',
        addFirst: 'Добавьте первую',
        loadingError: 'Ошибка загрузки',
        deleteBoard: 'Удалить доску',
        deleteBoardConfirm: 'Удалить всю доску?',
        boardNotFound: 'Доска не найдена',
        boardNoteTitle: 'Заголовок',
        boardNoteContent: 'Текст',
        editNoteTitle: 'Название',
        editNoteContent: 'Содержимое',
        addBoardNote: '+ Заметка',
        addBoardTask: '+ Задача',
        addBoardItem: '+ Задача/Заметка'
    },
    en: {
        notes: 'Notes',
        tasks: 'Tasks',
        boards: 'Boards',
        noNotes: 'No notes',
        noTasks: 'No tasks',
        noBoards: 'No boards',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        back: '← Back',
        share: 'Share',
        add: 'Add',
        remind: 'Remind',
        newNote: 'Note title',
        noteContent: 'Content',
        newTask: 'Task title',
        newBoard: 'New board',
        boardTitle: 'Board title',
        boardType: 'Board type:',
        loading: 'Loading...',
        empty: '(empty)',
        create: 'Create',
        remindWhen: 'When to remind?',
        pickDateTime: '📅 Pick date and time',
        boardCreated: '✅ Board created!',
        shareHint: 'Press «Share» to send board to chat',
        author: 'Author',
        sharedBoard: 'Shared board',
        guest: 'guest',
        unknown: 'unknown',
        addFirst: 'Add first',
        loadingError: 'Loading error',
        deleteBoard: 'Delete board',
        deleteBoardConfirm: 'Delete entire board?',
        boardNotFound: 'Board not found',
        boardNoteTitle: 'Title',
        boardNoteContent: 'Text',
        editNoteTitle: 'Title',
        editNoteContent: 'Content',
        addBoardNote: '+ Note',
        addBoardTask: '+ Task',
        addBoardItem: '+ Note/Task'
    }
};

function t(key) {
    return translations[currentLang]?.[key]
        ?? translations.ru?.[key]
        ?? key;
}

// ====== ТЕМА ======
let currentTheme = localStorage.getItem('tgnotion_theme') || 'dark';
applyTheme(currentTheme);

function applyTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('tgnotion_theme', theme);
}

// ====== API ======
async function apiGet(url) { const res = await fetch(url); return res.json(); }
async function apiPost(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
}
async function apiDelete(url) { const res = await fetch(url, { method: 'DELETE' }); return res.json(); }

// ====== ЗАМЕТКИ ======
async function loadNotes() {
    try {
        const userId = tg.initDataUnsafe?.user?.id;
        if (!userId) return;
        const data = await apiGet(`${API}?user_id=${userId}`);
        renderNotes(data.notes);
    } catch(e) { console.error(e); }
}

function renderNotes(notes) {
    const content = document.getElementById('content');
    if (!notes || notes.length === 0) {
        content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">${t('noNotes')}</p>`;
        return;
    }
    let html = '';
    notes.forEach(note => {
        const preview = note.content ? note.content.substring(0, 100) : '';
        html += `
            <div class="note-card" onclick="viewNote(${note.id}, '${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">
                <div class="note-header">
                    <h3>${escapeHtml(note.title)}</h3>
                    <button class="menu-btn" onclick="event.stopPropagation(); showNoteMenu(event, ${note.id})">⋯</button>
                </div>
                ${preview ? `<p>${escapeHtml(preview)}${note.content.length > 100 ? '...' : ''}</p>` : ''}
                <span class="note-date">${note.created_at}</span>
            </div>
        `;
    });
    content.innerHTML = html;
}

function showNoteMenu(event, id) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `<button onclick="deleteNote(${id}); this.parentElement.remove()">🗑 ${t('delete')}</button><button onclick="this.parentElement.remove()">✕ ${t('cancel')}</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function viewNote(id, title, content) {
    const div = document.getElementById('content');
    div.innerHTML = `<div class="form"><h3>${title}</h3><p>${content || t('empty')}</p><button class="btn btn-secondary" onclick="loadNotes()">${t('back')}</button></div>`;
}

function showNoteForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="noteTitle" placeholder="${t('newNote')}" class="input">
            <textarea id="noteContent" placeholder="${t('noteContent')}" class="textarea" rows="6"></textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveNoteBtn">${t('save')}</button>
                <button class="btn btn-secondary" id="cancelNoteBtn">${t('cancel')}</button>
            </div>
        </div>`;
    document.getElementById('saveNoteBtn').addEventListener('click', async () => {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        if (title) { await apiPost(API, { user_id: tg.initDataUnsafe.user.id, title, content }); loadNotes(); }
    });
    document.getElementById('cancelNoteBtn').addEventListener('click', loadNotes);
}

async function deleteNote(id) {
    await apiDelete(`${API}?id=${id}&user_id=${tg.initDataUnsafe.user.id}`);
    loadNotes();
}

// ====== ЗАДАЧИ ======
async function loadTasks() {
    try {
        const userId = tg.initDataUnsafe?.user?.id;
        if (!userId) return;
        const data = await apiGet(`/tasks?user_id=${userId}`);
        renderTasks(data.tasks);
    } catch(e) { console.error(e); }
}

function renderTasks(tasks) {
    const content = document.getElementById('content');
    if (!tasks || tasks.length === 0) {
        content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">${t('noTasks')}</p>`;
        return;
    }
    let html = '';
    tasks.forEach(task => {
        html += `
            <div class="note-card">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" ${task.is_done ? 'checked' : ''} onchange="toggleTask(${task.id}, this.checked)" style="width: 20px; height: 20px; accent-color: var(--accent);">
                    <span style="flex: 1; ${task.is_done ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${escapeHtml(task.title)}</span>
                    <button class="menu-btn" onclick="event.stopPropagation(); showTaskMenu(event, ${task.id}, '${task.remind_at || ''}')">⋯</button>
                </div>
            </div>`;
    });
    content.innerHTML = html;
}

function showTaskMenu(event, id, remindAt = '') {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button onclick="showRemindForm(${id}, '${remindAt}'); this.parentElement.remove()">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="vertical-align: middle; margin-right: 5px;"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${t('remind')}
        </button>
        <button onclick="deleteTask(${id}); this.parentElement.remove()">🗑 ${t('delete')}</button>
        <button onclick="this.parentElement.remove()">✕ ${t('cancel')}</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function showTaskForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="taskTitle" placeholder="${t('newTask')}" class="input">
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveTaskBtn">${t('add')}</button>
                <button class="btn btn-secondary" id="cancelTaskBtn">${t('cancel')}</button>
            </div>
        </div>`;
    document.getElementById('saveTaskBtn').addEventListener('click', async () => {
        const title = document.getElementById('taskTitle').value.trim();
        if (title) { await apiPost('/tasks', { user_id: tg.initDataUnsafe.user.id, title }); loadTasks(); }
    });
    document.getElementById('cancelTaskBtn').addEventListener('click', loadTasks);
}

async function toggleTask(id, isDone) {
    await fetch('/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_done: isDone }) });
}

async function deleteTask(id) {
    await apiDelete(`/tasks?id=${id}&user_id=${tg.initDataUnsafe.user.id}`);
    loadTasks();
}

// ====== ДОСКИ ======
async function loadBoards() {
    const content = document.getElementById('content');
    content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">${t('loading')}</p>`;
    try {
        const userId = tg.initDataUnsafe?.user?.id || 0;
        const data = await apiGet(`/api/boards?user_id=${userId}`);
        let html = `
            <div style="text-align: center; padding: 20px;">
                <button class="btn btn-primary" onclick="showBoardForm()">📋 ${t('newBoard')}</button>
                <div id="boardList" style="margin-top: 20px; text-align: left;">`;
        if (!data.boards || data.boards.length === 0) {
            html += `<p style="color: var(--text-secondary); text-align: center;">${t('noBoards')}</p>`;
        } else {
            data.boards.forEach(board => {
                html += `<div class="note-card" onclick="viewBoard('${board.hash}')">
                    <div class="note-header">
                        <h3>${escapeHtml(board.title)}</h3>
                        <button class="menu-btn" onclick="event.stopPropagation(); showBoardMenu(event, '${board.hash}')">⋯</button>
                    </div>
                    <span class="note-date">${board.created_at}</span>
                </div>`;
            });
        }
        html += `</div></div>`;
        content.innerHTML = html;
    } catch(e) {
        content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">${t('loadingError')}</p>`;
    }
}

function showBoardForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form" style="text-align: center;">
            <input type="text" id="boardTitle" placeholder="${t('boardTitle')}" class="input">
            <p style="color: var(--text-secondary); margin: 10px 0;">${t('boardType')}</p>
            <div class="form-buttons">
                <button class="btn btn-primary" id="typeNoteBtn">📝 ${t('notes')}</button>
                <button class="btn btn-secondary" id="typeTaskBtn">✅ ${t('tasks')}</button>
            </div>
            <div class="form-buttons" style="margin-top: 10px;">
                <button class="btn btn-primary" id="saveBoardBtn">${t('create')}</button>
                <button class="btn btn-secondary" id="cancelBoardBtn">${t('cancel')}</button>
            </div>
        </div>`;

    let boardType = 'note';

    document.getElementById('typeNoteBtn').addEventListener('click', () => {
        boardType = 'note';
        document.getElementById('typeNoteBtn').className = 'btn btn-primary';
        document.getElementById('typeTaskBtn').className = 'btn btn-secondary';
    });

    document.getElementById('typeTaskBtn').addEventListener('click', () => {
        boardType = 'task';
        document.getElementById('typeTaskBtn').className = 'btn btn-primary';
        document.getElementById('typeNoteBtn').className = 'btn btn-secondary';
    });

    document.getElementById('saveBoardBtn').addEventListener('click', async () => {
        const title = document.getElementById('boardTitle').value.trim();
        if (title) {
            const result = await apiPost(BOARDS_API, { user_id: tg.initDataUnsafe?.user?.id || 0, title, type: boardType });
            if (result.ok) {
                if (boardType === 'task') {
                    currentBoardHash = result.hash;
                    showBoardTaskForm(result.hash);
                } else {
                    const link = `https://t.me/Telega_notion_bot?startapp=boards_${result.hash}`;
                    document.getElementById('content').innerHTML = `
                        <div class="form" style="text-align: center;">
                            <h3>${t('boardCreated')}</h3>
                            <p style="color: var(--text-secondary);">${t('shareHint')}</p>
                            <button class="btn btn-primary" onclick="shareBoard('${result.hash}')">↪ ${t('share')}</button>
                            <button class="btn btn-secondary" onclick="loadBoards()">${t('back')}</button>
                        </div>`;
                }
            }
        }
    });

    document.getElementById('cancelBoardBtn').addEventListener('click', loadBoards);
}

function showBoardTaskForm(boardHash) {
    const content = document.getElementById('content');
    const userId = tg.initDataUnsafe?.user?.id || 0;
    content.innerHTML = `
        <div class="form">
            <input type="text" id="boardTaskTitle" placeholder="${t('newTask')}" class="input">
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveBoardTaskBtn">${t('add')}</button>
                <button class="btn btn-secondary" id="shareBoardTaskBtn">↪ ${t('share')}</button>
                <button class="btn btn-secondary" id="backToBoardBtn">${t('back')}</button>
            </div>
        </div>`;
    document.getElementById('saveBoardTaskBtn').addEventListener('click', async () => {
        const title = document.getElementById('boardTaskTitle').value.trim();
        if (title) {
            await apiPost(`/api/boards/${boardHash}/tasks`, { author_id: userId, title });
            document.getElementById('boardTaskTitle').value = '';
            viewBoard(boardHash);
        }
    });
    document.getElementById('shareBoardTaskBtn').addEventListener('click', () => shareBoard(boardHash));
    document.getElementById('backToBoardBtn').addEventListener('click', () => viewBoard(boardHash));
}

function shareBoard(hash) {
    tg.switchInlineQuery(`board_${hash}`, ['users', 'groups', 'channels']);
}

function viewBoard(hash) {
    currentBoardHash = hash;
    const content = document.getElementById('content');
    content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">${t('loading')}</p>`;
    fetch(`/api/boards/${hash}`).then(r => r.json()).then(data => {
        if (data.error) {
            content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">${t('boardNotFound')}</p>`;
            return;
        }
        const board = data.board;
        const author = board.author_username ? `@${board.author_username}` : t('unknown');
        const isTaskBoard = board.type === 'task';
        let html = `
            <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
                <h3>${isTaskBoard ? '✅' : '📋'} ${escapeHtml(board.title)}</h3>
                <p style="color: var(--text-secondary); font-size: 13px;">👤 ${t('author')}: ${author}</p>
                <p style="color: var(--text-secondary); font-size: 13px;">👥 ${t('sharedBoard')}</p>
            </div>`;
        if (!board.notes || board.notes.length === 0) {
            html += `<p style="color: var(--text-secondary);">${t('noBoards')}</p>`;
        } else {
            board.notes.forEach(note => {
                const noteAuthor = note.author_username ? `@${note.author_username}` : t('guest');
                if (isTaskBoard) {
                    html += `<div class="note-card">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" ${note.content === 'done' ? 'checked' : ''} onchange="toggleBoardTask('${board.hash}', ${note.id}, this.checked)" style="width: 20px; height: 20px; accent-color: var(--accent);">
                            <span style="flex: 1; ${note.content === 'done' ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${escapeHtml(note.title)}</span>
                            <button class="menu-btn" onclick="event.stopPropagation(); deleteBoardNote('${board.hash}', ${note.id})">🗑</button>
                        </div>
                    </div>`;
                } else {
                    html += `<div class="note-card">
                        <div class="note-header">
                            <h3 onclick="viewBoardNote('${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">${escapeHtml(note.title)}</h3>
                            <button class="menu-btn" onclick="event.stopPropagation(); showBoardNoteMenu(event, '${board.hash}', ${note.id}, '${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">⋯</button>
                        </div>
                        <p>${escapeHtml(note.content || '')}</p>
                        <span class="note-date">${note.created_at} — ${noteAuthor}</span>
                    </div>`;
                }
            });
        }
        html += `
            <div class="form-buttons" style="margin-top: 15px;">
                <button class="btn btn-primary" id="addBoardNoteBtn">${isTaskBoard ? t('addBoardTask') : t('addBoardNote')}</button>
                <button class="btn btn-primary" id="shareBoardBtn">↪ ${t('share')}</button>
                <button class="btn btn-secondary" onclick="loadBoards()">${t('back')}</button>
            </div>`;
        content.innerHTML = html;
        document.getElementById('addBoardNoteBtn')?.addEventListener('click', () => {
            if (isTaskBoard) {
                showBoardTaskForm(hash);
            } else {
                showBoardNoteForm(hash);
            }
        });
        document.getElementById('shareBoardBtn')?.addEventListener('click', () => shareBoard(hash));
    });
}

async function toggleBoardTask(boardHash, noteId, isDone) {
    await fetch(`/api/boards/${boardHash}/tasks/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: isDone, user_id: tg.initDataUnsafe.user.id })
    });
}

function viewBoardNote(title, content) {
    const div = document.getElementById('content');
    div.innerHTML = `
        <div class="form">
            <h3>${title}</h3>
            <p>${content || t('empty')}</p>
            <button class="btn btn-secondary" onclick="viewBoard(currentBoardHash)">${t('back')}</button>
        </div>`;
}

function showBoardNoteMenu(event, boardHash, noteId, noteTitle, noteContent) {
    document.querySelector('.context-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button onclick="editBoardNote('${boardHash}', ${noteId}, '${noteTitle}', '${noteContent}'); this.parentElement.remove()">✏️ ${t('edit')}</button>
        <button onclick="deleteBoardNote('${boardHash}', ${noteId}); this.parentElement.remove()">🗑 ${t('delete')}</button>
        <button onclick="this.parentElement.remove()">✕ ${t('cancel')}</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

async function deleteBoardNote(boardHash, noteId) {
    await apiDelete(`/api/boards/${boardHash}/notes/${noteId}?user_id=${tg.initDataUnsafe.user.id}`);
    viewBoard(boardHash);
}

async function editBoardNote(boardHash, noteId, oldTitle, oldContent) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="editNoteTitle" placeholder="${t('editNoteTitle')}" class="input" value="${oldTitle}">
            <textarea id="editNoteContent" placeholder="${t('editNoteContent')}" class="textarea" rows="4">${oldContent || ''}</textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveEditNoteBtn">${t('save')}</button>
                <button class="btn btn-secondary" id="cancelEditNoteBtn">${t('cancel')}</button>
            </div>
        </div>`;
    document.getElementById('saveEditNoteBtn').addEventListener('click', async () => {
        const newTitle = document.getElementById('editNoteTitle').value.trim();
        const newContent = document.getElementById('editNoteContent').value.trim();
        if (newTitle) {
            await fetch(`/api/boards/${boardHash}/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent, user_id: tg.initDataUnsafe.user.id })
            });
            viewBoard(boardHash);
        }
    });
    document.getElementById('cancelEditNoteBtn').addEventListener('click', () => viewBoard(boardHash));
}

function showBoardMenu(event, hash) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button onclick="deleteBoard('${hash}'); this.parentElement.remove()">🗑 ${t('deleteBoard')}</button>
        <button onclick="this.parentElement.remove()">✕ ${t('cancel')}</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

async function deleteBoard(hash) {
    if (confirm(t('deleteBoardConfirm'))) {
        await apiDelete(`/api/boards/${hash}`);
        loadBoards();
    }
}

function showBoardNoteForm(boardHash) {
    const content = document.getElementById('content');
    const userId = tg.initDataUnsafe?.user?.id || 0;
    content.innerHTML = `
        <div class="form">
            <input type="text" id="boardNoteTitle" placeholder="${t('boardNoteTitle')}" class="input">
            <textarea id="boardNoteContent" placeholder="${t('boardNoteContent')}" class="textarea" rows="4"></textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveBoardNoteBtn">${t('add')}</button>
                <button class="btn btn-secondary" id="cancelBoardNoteBtn">${t('cancel')}</button>
            </div>
        </div>`;
    document.getElementById('saveBoardNoteBtn').addEventListener('click', async () => {
        const title = document.getElementById('boardNoteTitle').value.trim();
        const content = document.getElementById('boardNoteContent').value.trim();
        if (title) {
            await apiPost(`/api/boards/${boardHash}/notes`, { author_id: userId, title, content });
            tg.close();
        }
    });
    document.getElementById('cancelBoardNoteBtn').addEventListener('click', () => viewBoard(boardHash));
}

function showRemindForm(taskId, remindAt = '') {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form" style="text-align: center;">
            <p style="color: var(--text-secondary); margin-bottom: 15px;">${t('remindWhen')}</p>
            <button class="btn btn-primary" id="pickDateBtn" style="width: 100%;">${t('pickDateTime')}</button>
            <div id="selectedTime" style="color: var(--accent); margin-top: 10px; font-size: 14px;">${remindAt ? new Date(remindAt).toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US') : ''}</div>
            <div class="form-buttons" style="margin-top: 15px;">
                <button class="btn btn-primary" id="saveRemindBtn">${t('save')}</button>
                <button class="btn btn-secondary" id="cancelRemindBtn">${t('cancel')}</button>
            </div>
        </div>`;

    let selectedDatetime = remindAt;

    document.getElementById('pickDateBtn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'datetime-local';
        if (selectedDatetime) {
            const d = new Date(selectedDatetime);
            const offset = d.getTimezoneOffset() * 60000;
            const local = new Date(d.getTime() - offset);
            input.value = local.toISOString().slice(0, 16);
        }
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
            if (input.value) {
                selectedDatetime = new Date(input.value).toISOString();
                document.getElementById('selectedTime').textContent = new Date(selectedDatetime).toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US');
            }
            input.remove();
        });
        input.focus();
        input.click();
        if (input.showPicker) input.showPicker();
    });

    document.getElementById('saveRemindBtn').addEventListener('click', async () => {
        if (selectedDatetime) {
            await fetch(`/tasks/${taskId}/remind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remind_at: new Date(selectedDatetime).toISOString().slice(0, 16) })
            });
            loadTasks();
        }
    });

    document.getElementById('cancelRemindBtn').addEventListener('click', loadTasks);
}

// ====== ОБЩЕЕ ======
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.querySelectorAll('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        if (currentTab === 'notes') loadNotes();
        else if (currentTab === 'tasks') loadTasks();
        else if (currentTab === 'boards') loadBoards();
    });
});

document.getElementById('addBtn').addEventListener('click', () => {
    if (currentTab === 'notes') showNoteForm();
    else if (currentTab === 'tasks') showTaskForm();
    else if (currentTab === 'boards') showBoardForm();
});

const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });
}

const langBtn = document.getElementById('langBtn');
if (langBtn) {
    langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'ru' ? 'en' : 'ru';
        localStorage.setItem('tgnotion_lang', currentLang);
        langBtn.textContent = currentLang === 'ru' ? 'EN' : 'RU';
        location.reload();
    });
}

// Обновляем текст вкладок
function updateTabs() {
    const notesTab = document.querySelector('[data-tab="notes"]');
    const tasksTab = document.querySelector('[data-tab="tasks"]');
    const boardsTab = document.querySelector('[data-tab="boards"]');
    if (notesTab) notesTab.textContent = t('notes');
    if (tasksTab) tasksTab.textContent = t('tasks');
    if (boardsTab) boardsTab.textContent = t('boards');
}

updateTabs();

const startParam = tg.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('tgWebAppStartParam');

if (startParam?.startsWith('board_task_add_')) {
    const hash = startParam.slice('board_task_add_'.length);
    currentBoardHash = hash;
    currentTab = 'boards';
    setTimeout(() => showBoardTaskForm(hash), 100);
}

if (startParam?.startsWith('board_add_')) {
    const hash = startParam.slice('board_add_'.length);
    currentBoardHash = hash;
    currentTab = 'boards';
    fetch(`/api/boards/${hash}`).then(r => r.json()).then(data => {
        alert(t('boardType') + ' ' + data.board?.type);
        if (data.board?.type === 'task') {
            setTimeout(() => showBoardTaskForm(hash), 100);
        } else {
            setTimeout(() => showBoardNoteForm(hash), 100);
        }
    });
} else if (startParam?.startsWith('boards_')) {
    const hash = startParam.slice('boards_'.length);
    currentTab = 'boards';
    document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="boards"]')?.classList.add('active');
    setTimeout(() => viewBoard(hash), 200);
} else if (window.location.pathname.startsWith('/boards/')) {
    const hash = window.location.pathname.split('/boards/')[1];
    if (hash) {
        currentTab = 'boards';
        document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
        const boardsTab = document.querySelector('[data-tab="boards"]');
        if (boardsTab) boardsTab.classList.add('active');
        setTimeout(() => viewBoard(hash), 100);
    }
} else {
    loadBoards();
}