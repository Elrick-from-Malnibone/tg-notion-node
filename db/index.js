const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = '/app/data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'data.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        theme TEXT DEFAULT 'dark',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        content TEXT DEFAULT '',
        is_shared INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        description TEXT DEFAULT '',
        is_done INTEGER DEFAULT 0,
        deadline TEXT,
        is_shared INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        remind_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event TEXT,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS board_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        author_id INTEGER,
        title TEXT,
        content TEXT DEFAULT '',
        type TEXT DEFAULT 'note',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (board_id) REFERENCES boards(id)
    );
`);
// Безопасная миграция: добавляем колонку type в boards, если её ещё нет
try {
    db.exec(`ALTER TABLE boards ADD COLUMN type TEXT DEFAULT 'note'`);
} catch (e) {
    // колонка уже существует — игнорируем
}

// Миграция: добавляем колонку type в board_notes, если её ещё нет
try {
    db.exec(`ALTER TABLE board_notes ADD COLUMN type TEXT DEFAULT 'note'`);
} catch (e) {
    // колонка уже существует — игнорируем
}

// Миграция: добавляем колонку remind_at в tasks, если её ещё нет
try {
    db.exec(`ALTER TABLE tasks ADD COLUMN remind_at TEXT`);
} catch (e) {
    // колонка уже существует — игнорируем
}

module.exports = db;