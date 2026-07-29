const db = require('../db');
const crypto = require('crypto');

function createBoard(userId, title, type = 'note') {
    const hash = crypto.randomBytes(4).toString('hex');
    db.prepare('INSERT INTO boards (hash, title, created_by, type) VALUES (?, ?, ?, ?)').run(hash, title, userId, type);
    return { hash, title, type };
}

function getBoard(hash) {
    const board = db.prepare('SELECT boards.*, users.username as author_username FROM boards LEFT JOIN users ON boards.created_by = users.id WHERE boards.hash = ?').get(hash);
    if (!board) return null;
    const notes = db.prepare('SELECT board_notes.*, users.username as author_username FROM board_notes LEFT JOIN users ON board_notes.author_id = users.id WHERE board_id = ? ORDER BY board_notes.created_at DESC').all(board.id);
    return { ...board, notes };
}

function addNote(boardHash, authorId, title, content, type = 'note') {
    const board = db.prepare('SELECT id FROM boards WHERE hash = ?').get(boardHash);
    if (!board) return null;
    const result = db.prepare('INSERT INTO board_notes (board_id, author_id, title, content, type) VALUES (?, ?, ?, ?, ?)').run(board.id, authorId, title, content || '', type);
    return { id: result.lastInsertRowid, title, content, type };
}

function deleteNote(boardHash, noteId, userId) {
    const board = db.prepare('SELECT id FROM boards WHERE hash = ?').get(boardHash);
    if (!board) return false;
    const note = db.prepare('SELECT author_id FROM board_notes WHERE id = ? AND board_id = ?').get(noteId, board.id);
    if (!note) return false;
    if (note.author_id !== userId) return false; // не автор
    db.prepare('DELETE FROM board_notes WHERE id = ? AND board_id = ?').run(noteId, board.id);
    return true;
}


function updateNote(boardHash, noteId, userId, title, content) {
    const board = db.prepare('SELECT id FROM boards WHERE hash = ?').get(boardHash);
    if (!board) return false;
    const note = db.prepare('SELECT author_id FROM board_notes WHERE id = ? AND board_id = ?').get(noteId, board.id);
    if (!note) return false;
    if (note.author_id !== userId) return false; // не автор
    db.prepare('UPDATE board_notes SET title = ?, content = ? WHERE id = ?').run(title, content || '', noteId);
    return true;
}

function addTask(boardHash, authorId, title) {
    return addNote(boardHash, authorId, title, '', 'task');
}

module.exports = { createBoard, getBoard, addNote, addTask, deleteNote, updateNote };