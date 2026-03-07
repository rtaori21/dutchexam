const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/words?page=1&limit=50&search=...
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';

    try {
        const stmt = db.prepare(`
      SELECT w.*, p.box, p.mastered, p.next_review
      FROM words w
      LEFT JOIN progress p ON w.id = p.word_id
      WHERE w.dutch LIKE ? OR w.english LIKE ?
      LIMIT ? OFFSET ?
    `);

        const words = stmt.all(search, search, limit, offset);

        // Count total with filters
        const countStmt = db.prepare(`
        SELECT count(*) as count FROM words 
        WHERE dutch LIKE ? OR english LIKE ?
    `);
        const total = countStmt.get(search, search).count;

        res.json({
            data: words,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/words/review
// Get words due for review (next_review <= now) OR new words (box is null)
// We prioritize Due Review, then New Words.
router.get('/review', (req, res) => {
    const limit = 20; // Daily session size
    const now = Date.now();

    try {
        // 1. Due reviews
        const dueStmt = db.prepare(`
      SELECT w.*, p.box, p.next_review
      FROM words w
      JOIN progress p ON w.id = p.word_id
      WHERE p.next_review <= ? AND p.mastered = 0
      ORDER BY p.next_review ASC
      LIMIT ?
    `);

        const dueWords = dueStmt.all(now, limit);

        // 2. New words (fill the rest of the limit)
        let newWords = [];
        if (dueWords.length < limit) {
            const remaining = limit - dueWords.length;
            const newStmt = db.prepare(`
        SELECT w.*, 0 as box, 0 as next_review
        FROM words w
        LEFT JOIN progress p ON w.id = p.word_id
        WHERE p.word_id IS NULL
        LIMIT ?
      `);
            newWords = newStmt.all(remaining);
        }

        res.json([...dueWords, ...newWords]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
