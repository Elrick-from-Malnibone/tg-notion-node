const db = require('../../db');

module.exports = (bot, adminId) => async (msg) => {
    if (msg.from.id !== adminId) return;

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const newToday = db.prepare("SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')").get().count;
    const newWeek = db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')").get().count;
    const totalNotes = db.prepare('SELECT COUNT(*) as count FROM notes').get().count;
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const lastUsers = db.prepare("SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5").all();

    const lastText = lastUsers.map(u => `@${u.username || 'без'} — ${u.created_at}`).join('\n') || 'никого';

    bot.sendMessage(msg.chat.id,
        `Юзеры:\n- Всего: ${totalUsers}\n- За сегодня: ${newToday}\n- За неделю: ${newWeek}\n\nКонтент:\n- Заметок: ${totalNotes}\n- Задач: ${totalTasks}\n\nПоследние 5:\n${lastText}`
    );
};