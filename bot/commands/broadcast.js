const db = require('../../db');

module.exports = (bot, adminId) => async (msg, match) => {
    if (msg.from.id !== adminId) return;

    const text = match[1].trim();
    const users = db.prepare('SELECT id FROM users').all();

    let success = 0, fail = 0;
    for (const user of users) {
        try {
            await bot.sendMessage(user.id, text);
            success++;
        } catch { fail++; }
    }

    bot.sendMessage(msg.chat.id, `Рассылка завершена:\n- Отправлено: ${success}\n- Не доставлено: ${fail}`);
};