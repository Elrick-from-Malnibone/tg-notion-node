const Database = require('better-sqlite3');

const oldDb = new Database('C:/Users/sysin/Desktop/Projects/notion/database.db');
const newDb = require('./db');

const oldUsers = oldDb.prepare('SELECT id, username FROM users').all();

let added = 0;
for (const user of oldUsers) {
    const exists = newDb.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
    if (!exists) {
        newDb.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(user.id, user.username);
        added++;
    }
}

console.log(`Перенесено: ${added} юзеров`);
oldDb.close();