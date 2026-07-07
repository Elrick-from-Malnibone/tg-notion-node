const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentTab = 'notes';
const API = '/notes'; // тот же домен, что и Mini App

async function apiGet(endpoint) {
    const res = await fetch(endpoint);
    return await res.json();
}

async function apiPost(endpoint, data) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return await res.json();
}

async function apiDelete(endpoint) {
    const res = await fetch(endpoint, { method: 'DELETE' });
    return await res.json();
}

async function loadNotes() {
    try {
        const userId = tg.initDataUnsafe.user.id;
        const data = await apiGet(`${API}?user_id=${userId}`);
        renderNotes(data.notes);
    } catch(e) {
        console.error(e);
    }
}

function loadTasks() {
    document.getElementById('content').innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Задачи скоро появятся</p>';
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
            <div class="note-card">
                <h3>${escapeHtml(note.title)}</h3>
                <p>${escapeHtml(note.content || '')}</p>
                <span class="note-date">${note.created_at}</span>
                <button class="delete-btn" data-id="${note.id}">🗑</button>
            </div>
        `;
    });
    content.innerHTML = html;
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(parseInt(btn.dataset.id));
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

function showTaskForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="form">
            <input type="text" id="taskTitle" placeholder="Название задачи" class="input">
            <textarea id="taskDescription" placeholder="Описание" class="textarea" rows="4"></textarea>
            <div class="form-buttons">
                <button class="btn btn-primary" id="saveTaskBtn">Сохранить</button>
                <button class="btn btn-secondary" id="cancelTaskBtn">Отмена</button>
            </div>
        </div>
    `;
    document.getElementById('saveTaskBtn').addEventListener('click', async () => {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        if (title) {
            await apiPost('/tasks', { user_id: tg.initDataUnsafe.user.id, title, description });
            loadTasks();
        }
    });
    document.getElementById('cancelTaskBtn').addEventListener('click', loadTasks);
}

async function deleteNote(id) {
    const ok = confirm('Удалить заметку?');
    if (ok) {
        await apiDelete(`${API}?id=${id}&user_id=${tg.initDataUnsafe.user.id}`);
        loadNotes();
    }
}

function deleteTask(id) {
    alert('Удаление задач пока не поддерживается');
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

loadNotes();