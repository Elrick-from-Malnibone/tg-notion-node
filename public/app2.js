const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentTab = 'notes';
let currentBoardHash = '';
const API = '/notes';
const BOARDS_API = '/api/boards';

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
        const userId = tg.initDataUnsafe.user.id;
        const data = await apiGet(`${API}?user_id=${userId}`);
        renderNotes(data.notes);
    } catch(e) { console.error(e); }
}

function renderNotes(notes) {
    const content = document.getElementById('content');
    if (!notes || notes.length === 0) {
        content.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Нет заметок</p>';
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
    menu.innerHTML = `<button onclick="deleteNote(${id}); this.parentElement.remove()">🗑 Удалить</button><button onclick="this.parentElement.remove()">✕ Отмена</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function viewNote(id, title, content) {
    const div = document.getElementById('content');
    div.innerHTML = `<div class="form"><h3>${title}</h3><p>${content || '(пусто)'}</p><button class="btn btn-secondary" onclick="loadNotes()">← Назад</button></div>`;
}

function showNoteForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="noteTitle" placeholder="Название заметки" class="input">
            <textarea id="noteContent" placeholder="Содержимое" class="textarea" rows="6"></textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveNoteBtn">Сохранить</button>
                <button class="btn btn-secondary" id="cancelNoteBtn">Отмена</button>
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
        const userId = tg.initDataUnsafe.user.id;
        const data = await apiGet(`/tasks?user_id=${userId}`);
        renderTasks(data.tasks);
    } catch(e) { console.error(e); }
}

function renderTasks(tasks) {
    const content = document.getElementById('content');
    if (!tasks || tasks.length === 0) {
        content.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Нет задач</p>';
        return;
    }
    let html = '';
    tasks.forEach(task => {
        html += `
            <div class="note-card">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" ${task.is_done ? 'checked' : ''} onchange="toggleTask(${task.id}, this.checked)" style="width: 20px; height: 20px; accent-color: var(--accent);">
                    <span style="flex: 1; ${task.is_done ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${escapeHtml(task.title)}</span>
                    <button class="menu-btn" onclick="event.stopPropagation(); showTaskMenu(event, ${task.id})">⋯</button>
                </div>
            </div>`;
    });
    content.innerHTML = html;
}

function showTaskMenu(event, id) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `<button onclick="deleteTask(${id}); this.parentElement.remove()">🗑 Удалить</button><button onclick="this.parentElement.remove()">✕ Отмена</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function showTaskForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="taskTitle" placeholder="Название задачи" class="input">
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveTaskBtn">Добавить</button>
                <button class="btn btn-secondary" id="cancelTaskBtn">Отмена</button>
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
    content.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Загрузка...</p>';
    try {
        const userId = tg.initDataUnsafe?.user?.id || 0;
        const data = await apiGet(`/api/boards?user_id=${userId}`);
        let html = `
            <div style="text-align: center; padding: 20px;">
                <button class="btn btn-primary" onclick="showBoardForm()">📋 Новая доска</button>
                <div id="boardList" style="margin-top: 20px; text-align: left;">`;
        if (!data.boards || data.boards.length === 0) {
            html += '<p style="color: var(--text-secondary); text-align: center;">Нет досок</p>';
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
        content.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Ошибка загрузки</p>';
    }
}

function showBoardForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="boardTitle" placeholder="Название доски" class="input">
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveBoardBtn">Создать</button>
                <button class="btn btn-secondary" id="cancelBoardBtn">Отмена</button>
            </div>
        </div>`;
    document.getElementById('saveBoardBtn').addEventListener('click', async () => {
        const title = document.getElementById('boardTitle').value.trim();
        if (title) {
            const result = await apiPost(BOARDS_API, { user_id: tg.initDataUnsafe.user.id, title });
            if (result.ok) {
                const link = `https://t.me/Telega_notion_bot?start=boards_${result.hash}`;
                document.getElementById('content').innerHTML = `
                    <div class="form" style="text-align: center;">
                        <h3>✅ Доска создана!</h3>
                        <button class="btn btn-primary" onclick="shareBoard('${result.hash}')">↪ Поделиться</button>
                        <button class="btn btn-secondary" onclick="loadBoards()">← Назад</button>
                    </div>`;
            }
        }
    });
    document.getElementById('cancelBoardBtn').addEventListener('click', loadBoards);
}

function shareBoard(hash) {
    tg.switchInlineQuery(`board_${hash}`, ['users', 'groups', 'channels']);
}

function viewBoard(hash) {
    currentBoardHash = hash;
    const content = document.getElementById('content');
    content.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Загрузка...</p>';
    fetch(`/api/boards/${hash}`).then(r => r.json()).then(data => {
        if (data.error) {
            content.innerHTML = `<p style="color: var(--text-secondary); padding: 20px;">Доска не найдена</p>`;
            return;
        }
        const board = data.board;
        const author = board.author_username ? `@${board.author_username}` : 'неизвестный';
        let html = `
            <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
                <h3>📋 ${escapeHtml(board.title)}</h3>
                <p style="color: var(--text-secondary); font-size: 13px;">👤 Автор: ${author}</p>
                <p style="color: var(--text-secondary); font-size: 13px;">👥 Общая доска</p>
            </div>`;
        if (!board.notes || board.notes.length === 0) {
            html += '<p style="color: var(--text-secondary);">Пока пусто. Добавьте первую заметку!</p>';
        } else {
            board.notes.forEach(note => {
                const noteAuthor = note.author_username ? `@${note.author_username}` : 'гость';
                html += `<div class="note-card">
                    <div class="note-header">
                        <h3 onclick="viewBoardNote('${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">${escapeHtml(note.title)}</h3>
                        <button class="menu-btn" onclick="event.stopPropagation(); showBoardNoteMenu(event, '${board.hash}', ${note.id}, '${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">⋯</button>
                    </div>
                    <p>${escapeHtml(note.content || '')}</p>
                    <span class="note-date">${note.created_at} — ${noteAuthor}</span>
                </div>`;
            });
        }
        html += `
            <div class="form-buttons" style="margin-top: 15px;">
                <button class="btn btn-primary" id="addBoardNoteBtn">+ Заметка</button>
                <button class="btn btn-primary" id="shareBoardBtn">↪  Поделиться</button>
                <button class="btn btn-secondary" onclick="loadBoards()">← Назад</button>
            </div>`;
        content.innerHTML = html;
        document.getElementById('addBoardNoteBtn')?.addEventListener('click', () => showBoardNoteForm(hash));
                document.getElementById('shareBoardBtn')?.addEventListener('click', () => {
            shareBoard(hash);
        });
    });
}

function viewBoardNote(title, content) {
    const div = document.getElementById('content');
    div.innerHTML = `
        <div class="form">
            <h3>${title}</h3>
            <p>${content || '(пусто)'}</p>
            <button class="btn btn-secondary" onclick="viewBoard(currentBoardHash)">← Назад</button>
        </div>`;
}

function showBoardNoteMenu(event, boardHash, noteId, noteTitle, noteContent) {
    document.querySelector('.context-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button onclick="editBoardNote('${boardHash}', ${noteId}, '${noteTitle}', '${noteContent}'); this.parentElement.remove()">✏️ Редактировать</button>
        <button onclick="deleteBoardNote('${boardHash}', ${noteId}); this.parentElement.remove()">🗑 Удалить</button>
        <button onclick="this.parentElement.remove()">✕ Отмена</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

async function deleteBoardNote(boardHash, noteId) {
    await apiDelete(`/api/boards/${boardHash}/notes/${noteId}`);
    viewBoard(boardHash);
}

async function editBoardNote(boardHash, noteId, oldTitle, oldContent) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="editNoteTitle" placeholder="Название" class="input" value="${oldTitle}">
            <textarea id="editNoteContent" placeholder="Содержимое" class="textarea" rows="4">${oldContent || ''}</textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveEditNoteBtn">Сохранить</button>
                <button class="btn btn-secondary" id="cancelEditNoteBtn">Отмена</button>
            </div>
        </div>`;
    document.getElementById('saveEditNoteBtn').addEventListener('click', async () => {
        const newTitle = document.getElementById('editNoteTitle').value.trim();
        const newContent = document.getElementById('editNoteContent').value.trim();
        if (newTitle) {
            await fetch(`/api/boards/${boardHash}/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent })
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
        <button onclick="deleteBoard('${hash}'); this.parentElement.remove()">🗑 Удалить доску</button>
        <button onclick="this.parentElement.remove()">✕ Отмена</button>`;
    menu.style.cssText = `position:fixed; top:${event.clientY}px; right:10px; z-index:1000;`;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

async function deleteBoard(hash) {
    if (confirm('Удалить всю доску?')) {
        await apiDelete(`/api/boards/${hash}`);
        loadBoards();
    }
}

function showBoardNoteForm(boardHash) {
    const content = document.getElementById('content');
    const userId = tg.initDataUnsafe?.user?.id || 0;
    content.innerHTML = `
        <div class="form">
            <input type="text" id="boardNoteTitle" placeholder="Заголовок" class="input">
            <textarea id="boardNoteContent" placeholder="Текст" class="textarea" rows="4"></textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveBoardNoteBtn">Добавить</button>
                <button class="btn btn-secondary" id="cancelBoardNoteBtn">Отмена</button>
            </div>
        </div>`;
    document.getElementById('saveBoardNoteBtn').addEventListener('click', async () => {
        const title = document.getElementById('boardNoteTitle').value.trim();
        const content = document.getElementById('boardNoteContent').value.trim();
        if (title) {
            await apiPost(`/api/boards/${boardHash}/notes`, { author_id: userId, title, content });
            viewBoard(boardHash);
        }
    });
    document.getElementById('cancelBoardNoteBtn').addEventListener('click', () => viewBoard(boardHash));
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

const startParam = tg.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('tgWebAppStartParam');
if (startParam && startParam.startsWith('boards_')) {
    const hash = startParam.split('boards_')[1];
    if (hash) {
        currentTab = 'boards';
        document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
        const boardsTab = document.querySelector('[data-tab="boards"]');
        if (boardsTab) boardsTab.classList.add('active');
        setTimeout(() => viewBoard(hash), 200);
    }
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
    loadNotes();
}