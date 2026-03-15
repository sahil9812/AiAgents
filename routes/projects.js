/**
 * routes/projects.js
 * Project CRUD — users can only access their own projects.
 * All routes require authentication.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/projects — list user's projects
router.get('/', (req, res) => {
    try {
        const projects = db.prepare(
            'SELECT id, name, model, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
        ).all(req.user.id);
        res.json({ projects });
    } catch (err) {
        console.error('Projects list error:', err);
        res.status(500).json({ error: 'Failed to list projects.' });
    }
});

// POST /api/projects — create a new project
router.post('/', (req, res) => {
    try {
        const { name, model = 'gemini' } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required.' });
        }
        const safeName = name.trim().slice(0, 100);
        const safeModel = ['gemini', 'deepseek'].includes(model) ? model : 'gemini';

        const result = db.prepare(
            'INSERT INTO projects (user_id, name, model) VALUES (?, ?, ?)'
        ).run(req.user.id, safeName, safeModel);

        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ project });
    } catch (err) {
        console.error('Project create error:', err);
        res.status(500).json({ error: 'Failed to create project.' });
    }
});

// PATCH /api/projects/:id — update project name/model
router.patch('/:id', (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
        if (!project) return res.status(404).json({ error: 'Project not found.' });

        const { name, model } = req.body;
        const newName = name ? name.trim().slice(0, 100) : project.name;
        const newModel = ['gemini', 'deepseek'].includes(model) ? model : project.model;

        db.prepare(
            'UPDATE projects SET name = ?, model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(newName, newModel, projectId);

        res.json({ project: { ...project, name: newName, model: newModel } });
    } catch (err) {
        console.error('Project update error:', err);
        res.status(500).json({ error: 'Failed to update project.' });
    }
});

// DELETE /api/projects/:id — delete project and all its files
router.delete('/:id', (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
        if (!project) return res.status(404).json({ error: 'Project not found.' });

        db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
        res.json({ success: true });
    } catch (err) {
        console.error('Project delete error:', err);
        res.status(500).json({ error: 'Failed to delete project.' });
    }
});

module.exports = router;
