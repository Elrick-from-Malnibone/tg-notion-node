const db = require('../db');
const crypto = require('crypto');

function createBoard(userId, title) {
    const hash = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO boards (hash, title, created_by) VALUES (?, ?, ?)').run(hash, title, userId);
    return { hash, title };
}

function getBoard(hash) {
    const board = db.prepare('SELECT boards.*, users.username as author_username FROM boards LEFT JOIN users ON boards.created_by = users.id WHERE boards.hash = ?').get(hash);
    if (!board) return null;
    const notes = db.prepare('SELECT board_notes.*, users.username as author_username FROM board_notes LEFT JOIN users ON board_notes.author_id = users.id WHERE board_id = ? ORDER BY board_notes.created_at DESC').all(board.id);
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


function updateNote(noteId, title, content) {
    db.prepare('UPDATE board_notes SET title = ?, content = ? WHERE id = ?').run(title, content || '', noteId);
    return true;
}

module.exports = { createBoard, getBoard, addNote, deleteNote, updateNote };