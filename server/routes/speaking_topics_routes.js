const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper: generate slug from name
function slugify(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// GET /api/speaking/topics
router.get('/', (req, res) => {
    try {
        const topics = db.prepare(`
            SELECT 
                t.*,
                COUNT(qa.id) AS total_qa,
                COUNT(sp.qa_id) AS practiced,
                SUM(CASE WHEN sp.confidence >= 3 THEN 1 ELSE 0 END) AS mastered
            FROM speaking_topics t
            LEFT JOIN speaking_qa qa ON qa.topic_id = t.id
            LEFT JOIN speaking_progress sp ON sp.qa_id = qa.id
            GROUP BY t.id
            ORDER BY t.sort_order ASC, t.name ASC
        `).all();

        res.json(topics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/speaking/topics/:id
router.get('/:id', (req, res) => {
    try {
        const topic = db.prepare('SELECT * FROM speaking_topics WHERE id = ?').get(req.params.id);

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        res.json(topic);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/speaking/topics
router.post('/', (req, res) => {
    const { name, description, icon } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }

    const slug = slugify(name);

    try {
        const stmt = db.prepare(`
            INSERT INTO speaking_topics (slug, name, description, icon, is_custom)
            VALUES (@slug, @name, @description, @icon, 1)
        `);

        const result = stmt.run({
            slug,
            name,
            description: description || null,
            icon: icon || 'MessageCircle'
        });

        const topic = db.prepare('SELECT * FROM speaking_topics WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(topic);
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'A topic with this name already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/speaking/topics/:id
router.put('/:id', (req, res) => {
    const { name, description, icon, sort_order } = req.body;

    try {
        const existing = db.prepare('SELECT * FROM speaking_topics WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        const stmt = db.prepare(`
            UPDATE speaking_topics SET
                name = @name,
                description = @description,
                icon = @icon,
                sort_order = @sort_order
            WHERE id = @id
        `);

        stmt.run({
            id: req.params.id,
            name: name || existing.name,
            description: description !== undefined ? description : existing.description,
            icon: icon || existing.icon,
            sort_order: sort_order !== undefined ? sort_order : existing.sort_order
        });

        const topic = db.prepare('SELECT * FROM speaking_topics WHERE id = ?').get(req.params.id);
        res.json(topic);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/speaking/topics/:id
router.delete('/:id', (req, res) => {
    try {
        const topic = db.prepare('SELECT * FROM speaking_topics WHERE id = ?').get(req.params.id);

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        if (!topic.is_custom) {
            return res.status(403).json({ error: 'Cannot delete built-in topics' });
        }

        db.prepare('DELETE FROM speaking_topics WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
