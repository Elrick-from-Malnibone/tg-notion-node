const db = require('../../db');

module.exports = (bot, adminId) => async (msg) => {
    if (msg.from.id !== adminId) return;

    const noteUsers = new Set(db.prepare('SELECT DISTINCT user_id FROM notes').all().map(r => r.user_id));
    const taskUsers = new Set(db.prepare('SELECT DISTINCT user_id FROM tasks').all().map(r => r.user_id));
    const activeUsers = new Set([...noteUsers, ...taskUsers]);
    const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    bot.sendMessage(msg.chat.id,
        `📊 Активность:\n- Всего юзеров: ${total}\n- Создали заметок/задач: ${activeUsers.size}\n- Просто зашли: ${total - activeUsers.size}`
    );
};