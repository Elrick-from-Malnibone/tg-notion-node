const db = require('../../db');

module.exports = (bot, adminId) => async (msg) => {
    const userId = msg.from.id;
    const username = msg.from.username;

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(userId, username);
        db.prepare('INSERT INTO user_events (user_id, event) VALUES (?, ?)').run(userId, 'registered');
        bot.sendMessage(adminId, `Новый пользователь: @${username || 'без'} (${userId})`);
    }

    bot.sendMessage(msg.chat.id, 'Добро пожаловать в TG Notion!');
};