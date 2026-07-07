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
        html += `
            <div class="note-card" onclick="viewNote(${note.id}, '${escapeHtml(note.title)}', '${escapeHtml(note.content || '')}')">
                <h3>${escapeHtml(note.title)}</h3>
                <p>${escapeHtml(note.content || '')}</p>
                <span class="note-date">${note.created_at}</span>
                <button class="delete-btn" data-id="${note.id}" onclick="event.stopPropagation(); deleteNote(${note.id})">🗑</button>
            </div>
        `;
    });
    content.innerHTML = html;
}

function viewNote(id, title, content) {
    const div = document.getElementById('content');
    div.innerHTML = `
        <div class="form">
            <h3>${title}</h3>
            <p>${content || '(пусто)'}</p>
            <button class="btn btn-secondary" onclick="loadNotes()">Назад</button>
        </div>
    `;
}

function showNoteForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="noteTitle" placeholder="Название заметки" class="input">
            <textarea id="noteContent" placeholder="Содержимое" class="textarea" rows="4"></textarea>
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
    if (confirm('Удалить заметку?')) {
        await apiDelete(`${API}?id=${id}&user_id=${tg.initDataUnsafe.user.id}`);
        loadNotes();
    }
}

// ====== ЗАДАЧИ ======
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tgnotion_tasks') || '[]');
    renderTasks(tasks);
}

function renderTasks(tasks) {
    const content = document.getElementById('content');
    if (!tasks || tasks.length === 0) {
        content.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Нет задач</p>';
        return;
    }
    let html = '';
    tasks.forEach((task, index) => {
        html += `
            <div class="note-card">
                <h3 style="${task.done ? 'text-decoration: line-through' : ''}">${task.done ? '✅ ' : ''}${escapeHtml(task.title)}</h3>
                <button class="btn btn-secondary" onclick="toggleTask(${index})" style="margin-right: 5px;">${task.done ? '↩' : '✓'}</button>
                <button class="delete-btn" onclick="deleteTask(${index})">🗑</button>
            </div>
        `;
    });
    content.innerHTML = html;
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
    document.getElementById('saveTaskBtn').addEventListener('click', () => {
        const title = document.getElementById('taskTitle').value.trim();
        if (title) {
            const tasks = JSON.parse(localStorage.getItem('tgnotion_tasks') || '[]');
            tasks.unshift({ title, done: false });
            localStorage.setItem('tgnotion_tasks', JSON.stringify(tasks));
            renderTasks(tasks);
        }
    });
    document.getElementById('cancelTaskBtn').addEventListener('click', loadTasks);
}

function toggleTask(index) {
    const tasks = JSON.parse(localStorage.getItem('tgnotion_tasks') || '[]');
    tasks[index].done = !tasks[index].done;
    localStorage.setItem('tgnotion_tasks', JSON.stringify(tasks));
    renderTasks(tasks);
}

function deleteTask(index) {
    if (confirm('Удалить задачу?')) {
        const tasks = JSON.parse(localStorage.getItem('tgnotion_tasks') || '[]');
        tasks.splice(index, 1);
        localStorage.setItem('tgnotion_tasks', JSON.stringify(tasks));
        renderTasks(tasks);
    }
}

// ====== ОБЩЕЕ ======
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        currentTab === 'notes' ? loadNotes() : loadTasks();
    });
});

document.getElementById('addBtn').addEventListener('click', () => {
    currentTab === 'notes' ? showNoteForm() : showTaskForm();
});

// Кнопка смены темы (добавим в index.html)
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
    });
}

loadNotes();