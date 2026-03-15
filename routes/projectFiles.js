/**
 * routes/projectFiles.js
 * File CRUD for projects — path validation prevents directory traversal.
 * All routes require authentication and project ownership.
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ── Security: validate file path ──────────────────────────────────────────────
function validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const p = filePath.trim();
    if (!p || p.length > 500) return false;
    // Prevent directory traversal
    if (p.includes('..')) return false;
    // Must be a relative path — no leading slash or drive letters
    if (/^[/\\]/.test(p) || /^[a-zA-Z]:/.test(p)) return false;
    // Only safe characters
    if (!/^[\w\-./]+$/.test(p)) return false;
    return true;
}

// Middleware: verify project exists and belongs to this user
function requireProject(req, res, next) {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID.' });
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    req.project = project;
    next();
}

// GET /api/projects/:projectId/files — list all files
router.get('/', requireProject, (req, res) => {
    try {
        const files = db.prepare(
            'SELECT path, content, updated_at FROM project_files WHERE project_id = ? ORDER BY path'
        ).all(req.project.id);
        res.json({ files });
    } catch (err) {
        console.error('File list error:', err);
        res.status(500).json({ error: 'Failed to list files.' });
    }
});

// POST /api/projects/:projectId/files — create or update a file (upsert)
router.post('/', requireProject, (req, res) => {
    try {
        const { path: filePath, content = '' } = req.body;
        if (!validatePath(filePath)) return res.status(400).json({ error: 'Invalid file path.' });

        db.prepare(
            `INSERT INTO project_files (project_id, path, content, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(project_id, path)
             DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`
        ).run(req.project.id, filePath.trim(), content);

        // Update project timestamp
        db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.project.id);
        res.json({ success: true });
    } catch (err) {
        console.error('File save error:', err);
        res.status(500).json({ error: 'Failed to save file.' });
    }
});

// POST /api/projects/:projectId/files/bulk — save multiple files at once
router.post('/bulk', requireProject, (req, res) => {
    try {
        const { files } = req.body;
        if (!Array.isArray(files)) return res.status(400).json({ error: 'files must be an array.' });

        const upsert = db.prepare(
            `INSERT INTO project_files (project_id, path, content, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(project_id, path)
             DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`
        );

        const bulkSave = db.transaction((items) => {
            for (const f of items) {
                if (!validatePath(f.path)) throw new Error(`Invalid path: ${f.path}`);
                upsert.run(req.project.id, f.path.trim(), f.content || '');
            }
        });

        bulkSave(files);
        db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.project.id);
        res.json({ success: true, count: files.length });
    } catch (err) {
        console.error('Bulk save error:', err);
        res.status(500).json({ error: err.message || 'Failed to save files.' });
    }
});

// PATCH /api/projects/:projectId/files/rename — rename a file
router.patch('/rename', requireProject, (req, res) => {
    try {
        const { oldPath, newPath } = req.body;
        if (!validatePath(oldPath) || !validatePath(newPath)) {
            return res.status(400).json({ error: 'Invalid file path.' });
        }

        // Check old file exists
        const existing = db.prepare(
            'SELECT id FROM project_files WHERE project_id = ? AND path = ?'
        ).get(req.project.id, oldPath.trim());
        if (!existing) return res.status(404).json({ error: 'File not found.' });

        // Check new path not already taken
        const conflict = db.prepare(
            'SELECT id FROM project_files WHERE project_id = ? AND path = ?'
        ).get(req.project.id, newPath.trim());
        if (conflict) return res.status(409).json({ error: 'A file at that path already exists.' });

        db.prepare(
            'UPDATE project_files SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND path = ?'
        ).run(newPath.trim(), req.project.id, oldPath.trim());

        res.json({ success: true });
    } catch (err) {
        console.error('Rename error:', err);
        res.status(500).json({ error: 'Failed to rename file.' });
    }
});

// DELETE /api/projects/:projectId/files — delete a file by path
router.delete('/', requireProject, (req, res) => {
    try {
        const { path: filePath } = req.body;
        if (!validatePath(filePath)) return res.status(400).json({ error: 'Invalid file path.' });

        db.prepare(
            'DELETE FROM project_files WHERE project_id = ? AND path = ?'
        ).run(req.project.id, filePath.trim());

        res.json({ success: true });
    } catch (err) {
        console.error('File delete error:', err);
        res.status(500).json({ error: 'Failed to delete file.' });
    }
});

module.exports = router;
