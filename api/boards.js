const db = require('../db');
const crypto = require('crypto');

function createBoard(userId, title) {
    const hash = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO boards (hash, title, created_by) VALUES (?, ?, ?)').run(hash, title, userId);
    return { hash, title };
}

function getBoard(hash) {
    const board = db.prepare('SELECT * FROM boards WHERE hash = ?').get(hash);
    if (!board) return null;
    const notes = db.prepare('SELECT * FROM board_notes WHERE board_id = ? ORDER BY created_at DESC').all(board.id);
    return { ...board, notes };
}

function addNote(boardHash, authorId, title, content) {
    const board = db.prepare('SELECT id FROM boards WHERE hash = ?').get(boardHash);
    if (!board) return null;
    const result = db.prepare('INSERT INTO board_notes (board_id, author_id, title, content) VALUES (?, ?, ?, ?)').run(board.id, authorId, title, content || '');
    return { id: result.lastInsertRowid, title, content };
}

function deleteNote(boardHash, noteId) {
    const board = db.prepare('SELECT id FROM boards WHERE hash = ?').get(boardHash);
    if (!board) return false;
    db.prepare('DELETE FROM board_notes WHERE id = ? AND board_id = ?').run(noteId, board.id);
    return true;
}

module.exports = { createBoard, getBoard, addNote, deleteNote };