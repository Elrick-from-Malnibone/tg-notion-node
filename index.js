const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const db = require('./db');
const boardsApi = require('./api/boards');

// ====== ПЕРЕВОДЫ ======
function getLang(from) {
    return from?.language_code?.startsWith('ru') ? 'ru' : 'en';
}

function t(lang, key) {
    const translations = {
        ru: {
            add: '➕ Добавить',
            openBoard: '📝 Открыть доску',
            refresh: '🔄 Обновить',
            newUser: 'Новый пользователь через доску',
            boardNotFound: 'Доска не найдена'
        },
        en: {
            add: '➕ Add',
            openBoard: '📝 Open board',
            refresh: '🔄 Refresh',
            newUser: 'New user via board',
            boardNotFound: 'Board not found'
        }
    };
    return translations[lang]?.[key] || translations.ru[key] || key;
}

const pendingBoardNotes = new Map();

const TOKEN = process.env.BOT_TOKEN || 'твой_токен';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '0');
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TOKEN, {
    polling: false
});
bot.setWebHook(`https://tgnotion.bothost.tech/bot${TOKEN}`, {
    allowed_updates: ['message', 'edited_message', 'inline_query', 'chosen_inline_result', 'callback_query']
}).then(() => {
    console.log('Webhook set with full allowed_updates');
}).catch(err => {
    console.error('Webhook error:', err.message);
});



// ====== КОМАНДЫ ======
bot.onText(/\/start (.+)/, async (msg, match) => {
    const payload = match[1];
    if (payload.startsWith('boards_')) {
        const hash = payload.split('boards_')[1];
        const board = boardsApi.getBoard(hash);
        if (!board) {
            bot.sendMessage(msg.chat.id, 'Доска не найдена');
            return;
        }
        const notesList = board.notes.slice(0, 5).map(n => `• ${n.title}`).join('\n') || 'Пока пусто';
        await bot.sendMessage(msg.chat.id, `📋 ${board.title}\n\n${notesList}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: t(getLang(msg.from), 'add'), url: `https://t.me/Telega_notion_bot?startapp=board_add_${hash}` }],
                    [{ text: t(getLang(msg.from), 'openBoard'), web_app: { url: `https://tgnotion.bothost.tech/boards/${hash}` } }],
                    [{ text: t(getLang(msg.from), 'refresh'), callback_data: `refresh_board_${hash}` }]
                ]
            }
        });
        return;
    }
    // обычная регистрация
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
    const boardNotes = db.prepare('SELECT COUNT(*) as c FROM board_notes').get().c;
    const last = db.prepare("SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5").all()
        .map(u => `@${u.username || 'без'} — ${u.created_at}`).join('\n') || 'никого';
    bot.sendMessage(msg.chat.id, `Юзеры:\n- Всего: ${total}\n- Сегодня: ${today}\n- Неделя: ${week}\n\nКонтент:\n- Заметок: ${notes}\n- Задач: ${tasks}\n- Досок: ${boards}\n- Заметок в досках: ${boardNotes}\n\nПоследние 5:\n${last}`);
});


bot.onText(/\/active/, async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const noteUsers = new Set(db.prepare('SELECT DISTINCT user_id FROM notes').all().map(r => r.user_id));
    const taskUsers = new Set(db.prepare('SELECT DISTINCT user_id FROM tasks').all().map(r => r.user_id));
    const active = new Set([...noteUsers, ...taskUsers]).size;
    const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    bot.sendMessage(msg.chat.id, `📊 Активность:\n- Всего: ${total}\n- Активных: ${active}\n- Просто зашли: ${total - active}`);
});

bot.onText(/\/broadcast ([\s\S]+)/, async (msg, match) => {
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

bot.onText(/\/fix_users/, async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;

    const lostUsers = db.prepare(`
        SELECT DISTINCT author_id FROM board_notes 
        WHERE author_id NOT IN (SELECT id FROM users)
    `).all();

    if (lostUsers.length === 0) {
        bot.sendMessage(msg.chat.id, 'Потерянных юзеров не найдено.');
        return;
    }

    let added = 0;
    for (const u of lostUsers) {
        db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(u.author_id);
        db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(u.author_id, 'recovered');
        added++;
    }

    bot.sendMessage(msg.chat.id, `Восстановлено юзеров: ${added}`);
});

bot.onText(/\/ac/, async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, `🔧 Админ-команды:\n\n/stats — статистика\n/active — активные юзеры\n/broadcast текст — рассылка\n/post — рассылка пересланного поста\n/migrate id1,id2,... — вернуть юзеров\n/fix_users — восстановить потерянных юзеров\n/ac — список команд`);
});

bot.on('callback_query', async (query) => {
    const data = query.data || '';
    const userId = query.from.id;
    const inlineMessageId = query.inline_message_id;

    // Авторегистрация
    const username = query.from.username;
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(userId, username);
        db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(userId, 'registered_callback');
        bot.sendMessage(ADMIN_ID, `Новый пользователь через доску: @${username || 'без'} (${userId})`);
    }

    if (data.startsWith('refresh_board_')) {
        const hash = data.slice('refresh_board_'.length);
        await updateInlineBoard(hash, inlineMessageId, getLang(query.from));
        await bot.answerCallbackQuery(query.id, { text: 'Обновлено' });
    }
});

bot.on('message', async (msg) => {
    if (!msg.text) return;

    const pending = pendingBoardNotes.get(msg.from.id);
    if (!pending) return;

    pendingBoardNotes.delete(msg.from.id);

    if (pending.expiresAt < Date.now()) {
        await bot.sendMessage(msg.chat.id, 'Время ожидания истекло.');
        return;
    }

    boardsApi.addNote(pending.hash, msg.from.id, msg.text.trim(), '');

    await updateInlineBoard(pending.hash, pending.inlineMessageId);

    await bot.sendMessage(msg.chat.id, 'Заметка добавлена ✅');
});

// Ожидание поста для рассылки
let waitingForPost = false;

bot.onText(/\/post/, async (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    
    waitingForPost = true;
    await bot.sendMessage(msg.chat.id, 'Жду пост. Пришли мне пересланное сообщение (можно из любого чата), и я разошлю его всем пользователям.');
});

bot.on('message', async (msg) => {
    if (!waitingForPost || msg.from.id !== ADMIN_ID) return;
    if (msg.text && msg.text.startsWith('/')) return;
    
    waitingForPost = false;
    
    const users = db.prepare('SELECT id FROM users').all();
    let ok = 0, fail = 0;
    
    await bot.sendMessage(msg.chat.id, 'Рассылка поста началась...');
    
    for (const user of users) {
        try {
            await bot.copyMessage(user.id, msg.chat.id, msg.message_id);
            ok++;
        } catch (err) {
            fail++;
        }
    }
    
    await bot.sendMessage(msg.chat.id, `Готово. Отправлено: ${ok}, не доставлено: ${fail}`);
});

async function updateInlineBoard(hash, inlineMessageId, lang = 'ru') {
    const board = boardsApi.getBoard(hash);
    if (!board || !inlineMessageId) return;

    const isTaskBoard = board.type === 'task';
    let text = `📋 ${board.title}\n\n`;
    
    if (isTaskBoard) {
        board.notes.forEach(note => {
            const done = note.content === 'done' ? '✅' : '☐';
            text += `${done} ${note.title}\n`;
        });
    } else {
        const notesList = board.notes.slice(0, 5).map(n => `• ${n.title}`).join('\n') || 'Пока пусто';
        text += notesList;
    }

    const keyboard = isTaskBoard ? {
        inline_keyboard: [
            [{ text: t(lang, 'add'), url: `https://t.me/Telega_notion_bot?startapp=board_task_add_${hash}` }],
            [{ text: t(lang, 'openBoard'), url: `https://t.me/Telega_notion_bot?startapp=boards_${hash}` }],
            [{ text: t(lang, 'refresh'), callback_data: `refresh_board_${hash}` }]
        ]
    } : {
        inline_keyboard: [
            [{ text: t(lang, 'add'), url: `https://t.me/Telega_notion_bot?startapp=board_task_add_${hash}` }],
            [{ text: t(lang, 'openBoard'), url: `https://t.me/Telega_notion_bot?startapp=boards_${hash}` }],
            [{ text: t(lang, 'refresh'), callback_data: `refresh_board_${hash}` }]
        ]
    };

    await bot.editMessageText(text, {
        inline_message_id: inlineMessageId,
        reply_markup: keyboard
    });
}

bot.on('inline_query', async (query) => {
    const userId = query.from.id;
    const username = query.from.username;
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(userId, username);
        db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(userId, 'registered_inline');
        bot.sendMessage(ADMIN_ID, `Новый пользователь через доску: @${username || 'без'} (${userId})`);
    }
    const hash = query.query.replace('board_', '');
    const board = boardsApi.getBoard(hash);
    if (!board) return;

    const isTaskBoard = board.type === 'task';
    let messageText = `📋 ${board.title}\n\n`;
    if (isTaskBoard) {
        board.notes.forEach(note => {
            const done = note.content === 'done' ? '✅' : '☐';
            messageText += `${done} ${note.title}\n`;
        });
    } else {
        const notesList = board.notes.slice(0, 5).map(n => `• ${n.title}`).join('\n') || 'Пока пусто';
        messageText += notesList;
    }

    try {
        await bot.answerInlineQuery(query.id, [{
            type: 'article',
            id: `board_${hash}`,
            title: `📋 ${board.title}`,
            description: `${board.notes.length} заметок`,
            input_message_content: {
                message_text: messageText
            },
            reply_markup: {
                inline_keyboard: [
                    [{ text: t(getLang(query.from), 'add'), url: `https://t.me/Telega_notion_bot?startapp=board_task_add_${hash}` }],
                    [{ text: t(getLang(query.from), 'openBoard'), url: `https://t.me/Telega_notion_bot?startapp=boards_${hash}` }],
                    [{ text: t(getLang(query.from), 'refresh'), callback_data: `refresh_board_${hash}` }]
                ]
            }
        }], {
            cache_time: 0,
            is_personal: true
        });
    } catch (err) {
        console.error('answerInlineQuery error:', err.response?.body || err);
    }
});

// ====== HTTP СЕРВЕР ======
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Webhook Telegram
    if (pathname.startsWith('/bot') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = JSON.parse(body);
            console.log('WEBHOOK RECEIVED:', JSON.stringify(data).substring(0, 200));
            try { 
                bot.processUpdate(data); 
            } catch(e) {
                console.error('Webhook error:', e.message);
            }
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

    // API: DELETE /notes
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
        const tasks = db.prepare('SELECT id, title, is_done, remind_at, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
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

    // API: DELETE /tasks
    if (pathname === '/tasks' && req.method === 'DELETE') {
        const id = parseInt(parsedUrl.query.id || '0');
        const userId = parseInt(parsedUrl.query.user_id || '0');
        db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    // API: POST /tasks/:id/remind
    const taskRemindMatch = pathname.match(/^\/tasks\/(\d+)\/remind$/);
    if (taskRemindMatch && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const taskId = parseInt(taskRemindMatch[1]);
            const { remind_at } = JSON.parse(body);
            const timestamp = new Date(remind_at).getTime();
            db.prepare('UPDATE tasks SET remind_at = ? WHERE id = ?').run(timestamp, taskId);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true }));
        });
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
            const { user_id, title, type } = JSON.parse(body);
            const board = boardsApi.createBoard(user_id, title, type);
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
            const { author_id, title, content, type } = JSON.parse(body);
            const note = boardsApi.addNote(boardNotesMatch[1], author_id, title, content, type);
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

    // API: POST /api/boards/:hash/tasks
    const boardTasksMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)\/tasks$/);
    if (boardTasksMatch && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { author_id, title } = JSON.parse(body);
            
            // Авторегистрация
            const user = db.prepare('SELECT id FROM users WHERE id = ?').get(author_id);
            if (!user) {
                db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(author_id);
                db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(author_id, 'registered_task');
                bot.sendMessage(ADMIN_ID, `Новый пользователь через задачу: ${author_id}`);
            }
            
            const task = boardsApi.addTask(boardTasksMatch[1], author_id, title);
            if (!task) {
                res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Board not found' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ ok: true, task }));
            }
        });
        return;
    }

    // API: PUT /api/boards/:hash/tasks/:id (toggle)
    const boardTaskToggleMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)\/tasks\/(\d+)$/);
    if (boardTaskToggleMatch && req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { is_done, user_id } = JSON.parse(body);
            const taskId = parseInt(boardTaskToggleMatch[2]);
            const task = db.prepare('SELECT author_id FROM board_notes WHERE id = ?').get(taskId);
            if (!task || task.author_id !== parseInt(user_id)) {
                res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ ok: false, error: 'Forbidden' }));
                return;
            }
            db.prepare('UPDATE board_notes SET content = ? WHERE id = ?').run(is_done ? 'done' : '', taskId);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true }));
        });
        return;
    }

    // API: POST /api/boards/share
    if (pathname === '/api/boards/share' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            const { hash, chat_id } = JSON.parse(body);
            const board = boardsApi.getBoard(hash);
            if (!board) {
                res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Board not found' }));
                return;
            }
            const notesList = board.notes.slice(0, 5).map(n => `• ${n.title}`).join('\n') || 'Пока пусто';
            await bot.sendMessage(chat_id, `📋 ${board.title}\n\n${notesList}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📝 Открыть доску', web_app: { url: `https://tgnotion.bothost.tech/boards/${hash}` } }],
                        [{ text: '🔄 Обновить', callback_data: `refresh_board_${hash}` }]
                    ]
                }
            });
            res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true }));
        });
        return;
    }

    // API: DELETE /api/boards/:hash/notes/:id
    const boardNoteDeleteMatch = pathname.match(/^\/api\/boards\/([a-f0-9]+)\/notes\/(\d+)$/);
    if (boardNoteDeleteMatch && req.method === 'DELETE') {
        const userId = parseInt(parsedUrl.query.user_id || '0');
        const ok = boardsApi.deleteNote(boardNoteDeleteMatch[1], parseInt(boardNoteDeleteMatch[2]), userId);
        res.writeHead(ok ? 200 : 403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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
            const { title, content, user_id } = JSON.parse(body);
            const ok = boardsApi.updateNote(boardNoteUpdateMatch[1], parseInt(boardNoteUpdateMatch[2]), parseInt(user_id), title, content);
            res.writeHead(ok ? 200 : 403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok }));
        });
        return;
    }

    // Health check для Bothost/Telegram
    if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
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

// Проверка напоминаний каждую минуту
setInterval(async () => {
    const now = Date.now();
    
    const dueTasks = db.prepare('SELECT id, user_id, title FROM tasks WHERE remind_at IS NOT NULL AND remind_at <= ? AND is_done = 0').all(now);
    
    for (const task of dueTasks) {
        try {
            await bot.sendMessage(task.user_id, `⏰ Напоминание: ${task.title}`);
            db.prepare('UPDATE tasks SET remind_at = NULL WHERE id = ?').run(task.id);
        } catch (err) {
            console.error('Remind error:', err.message);
        }
    }
}, 60000);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));