const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const creditsMiddleware = require('../middleware/credits');
const aiService = require('../services/aiService');

// Multer: memory storage, max 5MB, images only
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed.'));
    },
});

const CODING_SYSTEM_PROMPT = `You are a senior AI Coding and Task Automation Agent powered by Google Gemini.
You assist authenticated users in solving programming problems, generating code, debugging, researching topics, and automating technical tasks.

OPERATING RULES:
1. Understand the user's intent before responding.
2. Break complex tasks into logical steps internally.
3. Prefer simple, scalable, and secure solutions.
4. Use best practices for software engineering.
5. Never hallucinate APIs, libraries, or facts.
6. If requirements are unclear, make minimal assumptions and state them.
7. Be concise, but never incomplete.

OUTPUT FORMAT:
ALWAYS provide:
1. Clear, easy-to-understand explanation (keep definitions simple and medium-length).
2. Correct working code (complete, runnable, and formatted with markdown like \`\`\`javascript).
3. Step-by-step breakdown (how the code works).
4. Edge cases (potential pitfalls, things to watch out for).
5. CRITICAL RULE FOR COMPARISONS: If the user explicitly asks for a "side by side" comparison or to look at multiple things together, YOU MUST output the entire response as a Markdown Table. DO NOT output two distinct blocks of code consecutively. 
   Example format you MUST use for side by side requests:
   | Language | Code |
   |---|---|
   | Python | \`print("hello")\` |
   | Java | \`System.out.println("hello");\` |

MARKDOWN HYGIENE:
- NEVER mix regular text or paragraphs inside a code block (\`\`\`).
- ONLY put actual code and comments inside code blocks.
- ALWAYS leave an empty line before and after a code block.
- **CRITICAL TABLE FORMATTING**: When writing code inside a Markdown table layout, NEVER use \`<br>\` tags inside inline code blocks (e.g., \\\`line1<br>line2\\\`), because it breaks the formatting. Instead, use single-line examples or create multiple separate table rows.

SECURITY & QUALITY STANDARDS:
- Use secure defaults, validate inputs, handle errors, avoid hard-coded secrets, follow clean code principles.

You are a professional AI agent delivering real value in a paid product.`;

const GENERAL_SYSTEM_PROMPT = `You are a helpful, versatile, and general-purpose Chat Bot.
You assist authenticated users in answering questions on a wide variety of topics, providing explanations, brainstorming ideas, and engaging in friendly conversation.

OPERATING RULES:
1. Understand the user's intent before responding.
2. Be polite, helpful, and concise.
3. Provide accurate information to the best of your knowledge.
4. Refuse to answer dangerous, illegal, or harmful queries. Explain your refusal politely.
5. If requirements are unclear, ask for clarification.

OUTPUT FORMAT:
- Use clear formatting with Markdown when necessary.
- Be structured and easy to read.

You are a professional AI Chat Bot delivering real value.`;

// POST /api/agent/chat — SSE streaming response (supports optional image upload)
router.post('/chat', authMiddleware, creditsMiddleware, (req, res, next) => {
    // Only run multer if this is a multipart request (image upload)
    if (req.is('multipart/form-data')) {
        upload.single('image')(req, res, next);
    } else {
        next();
    }
}, async (req, res) => {
    const message = req.body.message;
    const conversationId = req.body.conversationId;
    const model = req.body.model || 'gemini'; // 'gemini' | 'deepseek'
    const botType = req.body.botType || 'coding'; // 'coding' | 'general'
    const selectedModel = ['gemini', 'deepseek'].includes(model) ? model : 'gemini';
    // For JSON requests, history is already parsed. For FormData, it's a string.
    const historyRaw = typeof req.body.history === 'string'
        ? req.body.history
        : JSON.stringify(req.body.history || []);
    const imageFile = req.file; // multer file (optional)


    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: 'message is required.' });
    }
    if (message.length > 8000) {
        return res.status(400).json({ error: 'Message too long (max 8000 chars).' });
    }

    // ── Setup SSE headers ─────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    // ── Resolve or create conversation ────────────────────────────────────────
    let convId = conversationId ? parseInt(conversationId) : null;
    let isNewChat = !conversationId;

    if (isNewChat) {
        const result = db.prepare('INSERT INTO conversations (user_id, title, bot_type) VALUES (?, ?, ?)').run(req.user.id, 'New Chat', botType);
        convId = result.lastInsertRowid;
        send({ type: 'conversation', conversationId: convId, title: 'New Chat', botType });
    } else {
        const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(convId, req.user.id);
        if (!conv) {
            send({ type: 'error', error: 'Conversation not found.' });
            return res.end();
        }
        db.prepare('UPDATE conversations SET bot_type = ? WHERE id = ?').run(botType, convId);
    }

    // Save user message (store image indicator in content if present)
    const savedContent = imageFile ? `[Image attached] ${message.trim()}` : message.trim();
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'user', savedContent);

    try {
        // Parse history
        let history = [];
        try { history = JSON.parse(historyRaw || '[]'); } catch { history = []; }

        // ── Stream response ───────────────────────────────────────────────────
        let fullResponse = '';

        // Ensure the correct effective model is used regardless of image presence
        const effectiveModel = selectedModel;

        // Build parts for models if image attached
        let runPrompt = message.trim();
        if (imageFile) {
            if (effectiveModel === 'gemini') {
                runPrompt = [
                    { inlineData: { mimeType: imageFile.mimetype, data: imageFile.buffer.toString('base64') } },
                    { text: message.trim() },
                ];
            } else if (effectiveModel === 'deepseek') {
                // The deepseek-chat API does not support vision (image_url). 
                // We fallback to sending only the text so the app doesn't crash 400.
                runPrompt = message.trim() + "\n\n[System Note: The user attached an image to this message, but you are a text-only model and cannot see it. Please politely decline visual requests and answer the text portion as best you can.]";
            }
        }

        await aiService.stream({
            model: effectiveModel,
            prompt: runPrompt,
            systemPrompt: botType === 'general' ? GENERAL_SYSTEM_PROMPT : CODING_SYSTEM_PROMPT,
            history,
            onChunk: (text) => {
                fullResponse += text;
                send({ type: 'chunk', text: fullResponse });
            },
            onDone: async () => {
                // Save agent message
                db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(convId, 'model', fullResponse);

                // Update conversation title
                let chatTitle = message.slice(0, 60);
                if (isNewChat) {
                    try {
                        const { GoogleGenerativeAI } = require('@google/generative-ai');
                        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                        const titleModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
                        const titlePrompt = `Generate a concise 3-4 word title for a conversation that starts with exactly this prompt: "${message.slice(0, 300)}". Output ONLY the title, no quotes or additional text.`;
                        const titleResult = await titleModel.generateContent(titlePrompt);
                        const generated = titleResult.response.text().trim().replace(/^["']|["']$/g, '');
                        if (generated) chatTitle = generated;
                    } catch (e) {
                        console.error('Failed to generate title:', e);
                    }
                }

                db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, title = CASE WHEN title = ? THEN ? ELSE title END WHERE id = ?')
                    .run('New Chat', chatTitle, convId);

                let finalCredits;
                if (req.user.role === 'admin') {
                    finalCredits = 'Unlimited';
                } else {
                    db.prepare('UPDATE users SET credits = credits - 1 WHERE id = ?').run(req.user.id);
                    const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);
                    finalCredits = updatedUser.credits;
                    db.prepare('INSERT INTO credit_history (user_id, amount, reason, balance_after) VALUES (?, -1, ?, ?)').run(req.user.id, 'chat', finalCredits);
                }

                send({ type: 'done', credits: finalCredits, conversationId: convId });
                res.end();
            },
            onError: (errMsg) => {
                send({ type: 'error', error: errMsg });
                res.end();
            },
        });

    } catch (err) {
        console.error('Agent stream error:', err);
        if (err.name === 'AbortError') return res.end();
        send({ type: 'error', error: 'AI service error. Please try again.' });
        res.end();
    }
});

module.exports = router;
