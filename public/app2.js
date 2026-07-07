const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentTab = 'notes';
const API = '/notes';

// ====== ТЕМА ======
let currentTheme = localStorage.getItem('tgnotion_theme') || 'dark';
applyTheme(currentTheme);

function applyTheme(theme) {
    document.body.className = theme;
    localStorage.setItem('tgnotion_theme', theme);
}

// ====== API ======
async function apiGet(url) {
    const res = await fetch(url);
    return res.json();
}

async function apiPost(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function apiDelete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    return res.json();
}

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
    menu.innerHTML = `
        <button onclick="deleteNote(${id}); this.parentElement.remove()">🗑 Удалить</button>
        <button onclick="this.parentElement.remove()">✕ Отмена</button>
    `;
    menu.style.position = 'fixed';
    menu.style.top = event.clientY + 'px';
    menu.style.right = '10px';
    menu.style.zIndex = '1000';
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function viewNote(id, title, content) {
    const div = document.getElementById('content');
    div.innerHTML = `
        <div class="form">
            <h3>${title}</h3>
            <p>${content || '(пусто)'}</p>
            <button class="btn btn-secondary" onclick="loadNotes()">← Назад</button>
        </div>
    `;
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
        </div>
    `;
    document.getElementById('saveNoteBtn').addEventListener('click', async () => {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();
        if (title) {
            await apiPost(API, { user_id: tg.initDataUnsafe.user.id, title, content });
            loadNotes();
        }
    });
    document.getElementById('cancelNoteBtn').addEventListener('click', loadNotes);
}

async function deleteNote(id) {
    await apiDelete(`${API}?id=${id}&user_id=${tg.initDataUnsafe.user.id}`);
    loadNotes();
}

// ====== ЗАДАЧИ (как в прошлой версии) ======
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
            </div>
        `;
    });
    content.innerHTML = html;
}

function showTaskMenu(event, id) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button onclick="deleteTask(${id}); this.parentElement.remove()">🗑 Удалить</button>
        <button onclick="this.parentElement.remove()">✕ Отмена</button>
    `;
    menu.style.position = 'fixed';
    menu.style.top = event.clientY + 'px';
    menu.style.right = '10px';
    menu.style.zIndex = '1000';
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
        </div>
    `;
    document.getElementById('saveTaskBtn').addEventListener('click', async () => {
        const title = document.getElementById('taskTitle').value.trim();
        if (title) {
            await apiPost('/tasks', { user_id: tg.initDataUnsafe.user.id, title });
            loadTasks();
        }
    });
    document.getElementById('cancelTaskBtn').addEventListener('click', loadTasks);
}

async function toggleTask(id, isDone) {
    await fetch('/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_done: isDone })
    });
}

async function deleteTask(id) {
    await apiDelete(`/tasks?id=${id}&user_id=${tg.initDataUnsafe.user.id}`);
    loadTasks();
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
        currentTab === 'notes' ? loadNotes() : loadTasks();
    });
});

document.getElementById('addBtn').addEventListener('click', () => {
    currentTab === 'notes' ? showNoteForm() : showTaskForm();
});

// Тема
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });
}

loadNotes();