const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const db = require('./db');
const boardsApi = require('./api/boards');

const TOKEN = process.env.BOT_TOKEN || 'твой_токен';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '0');
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TOKEN, { webhook: { port: PORT } });
bot.setWebHook(`https://tgnotion.bothost.tech/bot${TOKEN}`);

// ====== КОМАНДЫ ======
bot.onText(/\/start (.+)/, async (msg, match) => {
    const payload = match[1];
    if (payload.startsWith('boards_')) {
        const hash = payload.split('boards_')[1];
        await bot.sendMessage(msg.chat.id, 'Открываю доску...', {
            reply_markup: {
                inline_keyboard: [[{
                    text: '📋 Открыть доску',
                    web_app: { url: `https://tgnotion.bothost.tech/boards/${hash}` }
                }]]
            }
        });
        return;
    }
    // Если другой параметр — обычная регистрация
    const userId = msg.from.id;
    const username = msg.from.username;
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(userId, username);
        db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(userId, 'registered');
        bot.sendMessage(ADMIN_ID, `Новый пользователь: @${username || 'без'} (${userId})`);
    }
    bot.sendMessage(msg.chat.id, 'Добро пожаловать в TG Notion!');
});

bot.onText(/^\/start$/, async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username;
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(userId, username);
        db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(userId, 'registered');
        bot.sendMessage(ADMIN_ID, `Новый пользователь: @${username || 'без'} (${userId})`);
    }
    bot.sendMessage(msg.chat.id, 'Добро пожаловать в TG Notion!');
});

bot.onText(/\/stats/, async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const today = db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at) = date('now')").get().c;
    const week = db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-7 days')").get().c;
    const notes = db.prepare('SELECT COUNT(*) as c FROM notes').get().c;
    const tasks = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
    const boards = db.prepare('SELECT COUNT(*) as c FROM boards').get().c;
    const last = db.prepare("SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5").all()
        .map(u => `@${u.username || 'без'} — ${u.created_at}`).join('\n') || 'никого';
    bot.sendMessage(msg.chat.id, `Юзеры:\n- Всего: ${total}\n- Сегодня: ${today}\n- Неделя: ${week}\n\nКонтент:\n- Заметок: ${notes}\n- Задач: ${tasks}\n- Досок: ${boards}\n\nПоследние 5:\n${last}`);
});

bot.onText(/\/active/, async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const noteUsers = new Set(db.prepare('SELECT DISTINCT user_id FROM notes').all().map(r => r.user_id));
    const taskUsers = new Set(db.prepare('SELECT DISTINCT user_id FROM tasks').all().map(r => r.user_id));
    const active = new Set([...noteUsers, ...taskUsers]).size;
    const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    bot.sendMessage(msg.chat.id, `📊 Активность:\n- Всего: ${total}\n- Активных: ${active}\n- Просто зашли: ${total - active}`);
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const text = match[1];
    const users = db.prepare('SELECT id FROM users').all();
    let ok = 0, fail = 0;
    for (const u of users) {
        try { await bot.sendMessage(u.id, text); ok++; } catch { fail++; }
    }
    bot.sendMessage(msg.chat.id, `Рассылка:\n- Отправлено: ${ok}\n- Не доставлено: ${fail}`);
});

bot.onText(/\/migrate (.+)/, async (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const ids = match[1].split(',').map(id => parseInt(id.trim()));
    let ok = 0, fail = 0;
    for (const id of ids) {
        try {
            await bot.sendMessage(id, 'Сорян за техношатания — бот переехал на новый сервер, базу восстанавливал по кускам. Теперь всё работает стабильно. Плюс запилил общие доски: создаёшь доску, кидаешь ссылку, добавляете заметки вместе.\n\nНажми /start для возобновления работы.\n\nСледи за обновлениями: @system_develope');
            ok++;
        } catch { fail++; }
    }
    bot.sendMessage(msg.chat.id, `Отправлено: ${ok}, не доставлено: ${fail}`);
});

// ====== HTTP СЕРВЕР ======
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Webhook Telegram
    if (pathname.startsWith('/bot')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { bot.processUpdate(JSON.parse(body)); } catch(e) {}
            res.writeHead(200);
            res.end('ok');
        });
        return;
    }

    // API: GET /notes?user_id=...
    if (pathname === '/notes' && req.method === 'GET') {
        const userId = parseInt(parsedUrl.query.user_id || '0');
        const notes = db.prepare('SELECT id, title, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ notes }));
        return;
    }

    // API: POST /notes
    if (pathname === '/notes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { user_id, title, content } = JSON.parse(body);
            const result = db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)').run(user_id, title, content || '');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, id: result.lastInsertRowid }));
        });
        return;
    }

    // API: DELETE /notes?id=...&user_id=...
    if (pathname === '/notes' && req.method === 'DELETE') {
        const id = parseInt(parsedUrl.query.id || '0');
        const userId = parseInt(parsedUrl.query.user_id || '0');
        db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, userId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

        // API: GET /tasks?user_id=...
    if (pathname === '/tasks' && req.method === 'GET') {
        const userId = parseInt(parsedUrl.query.user_id || '0');
        const tasks = db.prepare('SELECT id, title, is_done, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ tasks }));
        return;
    }

    // API: POST /tasks
    if (pathname === '/tasks' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { user_id, title } = JSON.parse(body);
            const result = db.prepare('INSERT INTO tasks (user_id, title) VALUES (?, ?)').run(user_id, title);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, id: result.lastInsertRowid }));
        });
        return;
    }

    // API: PUT /tasks (toggle done)
    if (pathname === '/tasks' && req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { id, is_done } = JSON.parse(body);
            db.prepare('UPDATE tasks SET is_done = ? WHERE id = ?').run(is_done ? 1 : 0, id);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true }));
        });
        return;
    }

    // API: DELETE /tasks?id=...&user_id=...
    if (pathname === '/tasks' && req.method === 'DELETE') {
        const id = parseInt(parsedUrl.query.id || '0');
        const userId = parseInt(parsedUrl.query.user_id || '0');
        db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    
        // API: GET /boards?user_id=...
    if (pathname === '/api/boards' && req.method === 'GET') {
        const query = require('url').parse(req.url, true).query;
        const userId = parseInt(query.user_id || '0');
        const boards = db.prepare('SELECT * FROM boards WHERE created_by = ? ORDER BY created_at DESC').all(userId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ boards }));
        return;
    }

        // API: POST /boards
    if (pathname === '/api/boards' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { user_id, title } = JSON.parse(body);
            const board = boardsApi.createBoard(user_id, title);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, hash: board.hash }));
        });
        return;
    }

    // Страница доски — отдаём index.html
    const boardPageMatch = pathname.match(/^\/boards\/([a-f0-9]+)$/);
    if (boardPageMatch && req.method === 'GET') {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(indexPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading page');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
        return;
    }

    // API доски — отдаём JSON
    const boardApiMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)$/);
    if (boardApiMatch && req.method === 'GET') {
        const board = boardsApi.getBoard(boardApiMatch[1]);
        if (!board) {
            res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Board not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ board }));
        return;
    }

    // API: POST /api/boards/:hash/notes
    const boardNotesMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)\/notes$/);
    if (boardNotesMatch && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { author_id, title, content } = JSON.parse(body);
            const note = boardsApi.addNote(boardNotesMatch[1], author_id, title, content);
            if (!note) {
                res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Board not found' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ ok: true, note }));
            }
        });
        return;
    }

    // API: DELETE /api/boards/:hash/notes/:id
    const boardNoteDeleteMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)\/notes\/(\d+)$/);
    if (boardNoteDeleteMatch && req.method === 'DELETE') {
        const ok = boardsApi.deleteNote(boardNoteDeleteMatch[1], parseInt(boardNoteDeleteMatch[2]));
        res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok }));
        return;
    }

    // API: DELETE /api/boards/:hash
    const boardDeleteMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)$/);
    if (boardDeleteMatch && req.method === 'DELETE') {
        const hash = boardDeleteMatch[1];
        const board = db.prepare('SELECT id FROM boards WHERE hash = ?').get(hash);
        if (board) {
            db.prepare('DELETE FROM board_notes WHERE board_id = ?').run(board.id);
            db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

        // API: PUT /api/boards/:hash/notes/:id
    const boardNoteUpdateMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)\/notes\/(\d+)$/);
    if (boardNoteUpdateMatch && req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { title, content } = JSON.parse(body);
            db.prepare('UPDATE board_notes SET title = ?, content = ? WHERE id = ?').run(title, content || '', parseInt(boardNoteUpdateMatch[2]));
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true }));
        });
        return;
    }

    // Статика Mini App
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(__dirname, 'public', filePath);
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
    fs.readFile(fullPath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); }
        else {
            res.writeHead(200, { 'Content-Type': mime[path.extname(fullPath)] || 'text/plain' });
            res.end(data);
        }
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));