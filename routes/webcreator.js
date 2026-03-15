const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const creditsMiddleware = require('../middleware/credits');
const aiService = require('../services/aiService');

const SYSTEM_PROMPT = `You are an expert AI software engineer working inside an AI website builder.

Your job is to generate minimal, modular code for modern web projects.

========================
DESIGN REQUIREMENTS
========================

- Modern UI
- Fully responsive
- Professional layout
- Clean spacing
- Accessible
- SEO friendly
- Organized folder structure
- Scalable architecture
- Use reusable components

========================
PREVIEW COMPATIBILITY RULES
========================

When generating websites for this platform, follow these preview compatibility rules.

If you are creating website using HTML/CSS/JS:
Generate plain static files that run directly in the browser.

If you are creating webiste using React or JSX:
Generate a React-compatible preview environment.

Requirements:
- Include React and ReactDOM CDN links in index.html.
- Include Babel standalone CDN to compile JSX.
- Wrap the JSX code inside: <script type="text/babel">
- Ensure the code renders inside a root element.

Example root:
<div id="root"></div>
<script type="text/babel">
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(<App />);
</script>

Always ensure the preview can run immediately in a browser without requiring a build step.

========================
PROJECT EDITING RULES
========================

1. Analyze the existing project files before generating any code.
2. Identify which files must be changed to implement the user request.
3. Modify ONLY the required files.
4. Do NOT regenerate unrelated files.
5. If a file already exists, update the necessary section instead of replacing the entire file.
6. If the change affects UI layout, only modify the relevant component.
7. If a new feature is required, create new files instead of rewriting existing ones.

Never regenerate the entire project when the user asks for a modification.

========================
RESPONSE FORMAT
========================

Return only the files that need modification.
Use this EXACT JSON format:

{
  "changes": [
    {
      "type": "modify",
      "path": "path/to/file.ext",
      "content": "full updated code for this file"
    },
    {
      "type": "create",
      "path": "path/to/new_file.ext",
      "content": "code here"
    }
  ],
  "recommendations": [
    "authentication system",
    "dark mode",
    "mobile optimization"
  ]
}

- For "path", ALWAYS use the exact file path (e.g. index.html, components/Navbar.jsx).
- For "content", provide the FULL contents of the file. No partial snippets.
- Use "type" as either "create", "modify", or "delete".

Never output the entire project. Never return raw HTML or markdown outside the JSON structure.

========================
FEATURE RECOMMENDATION SYSTEM
========================

After completing the user's request, recommend 3-5 useful features that could improve the project.
Add these as brief string labels in the "recommendations" array.

========================
IMPORTANT
========================

Never regenerate the full project unless the user explicitly asks to "rebuild entire project".
Always prioritize editing existing files.`;

router.post('/generate', authMiddleware, creditsMiddleware, async (req, res) => {
    try {
        const { prompt, previousJson, model = 'gemini' } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }

        // Sanitize model input
        const selectedModel = ['gemini', 'deepseek'].includes(model) ? model : 'gemini';

        let fullPrompt = prompt;
        if (previousJson) {
            fullPrompt = `Modify the following project based on this request: "${prompt}"\n\nCurrent Project JSON:\n${JSON.stringify(previousJson)}`;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

        let fullResponseText = '';

        await aiService.stream({
            model: selectedModel,
            prompt: fullPrompt,
            systemPrompt: SYSTEM_PROMPT,
            generationConfig: {
                responseMimeType: selectedModel === 'gemini' ? 'application/json' : undefined,
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
            },
            onChunk: (text) => {
                fullResponseText += text;
                send({ type: 'chunk', text });
            },
            onDone: async () => {
                // Validate + parse JSON
                let parsedJson;
                try {
                    let cleanText = fullResponseText.trim();
                    if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/```json/i, '');
                    if (cleanText.endsWith('```')) cleanText = cleanText.replace(/```$/, '');
                    
                    const startIndex = cleanText.indexOf('{');
                    const endIndex = cleanText.lastIndexOf('}');
                    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                        cleanText = cleanText.substring(startIndex, endIndex + 1);
                    }

                    // Fallback for raw HTML response
                    if (cleanText.startsWith('<') || cleanText.toLowerCase().startsWith('<!doctype')) {
                        parsedJson = { changes: [{ type: 'modify', path: 'index.html', content: cleanText }] };
                    } else {
                        parsedJson = JSON.parse(cleanText);
                    }
                } catch (e) {
                    console.error('Failed to parse AI response as JSON:', fullResponseText.slice(0, 200));
                    send({ type: 'error', message: 'AI returned invalid JSON format.' });
                    return res.end();
                }

                // Merge changes into final complete project structure
                let finalProject = { files: [] };
                
                // Start with existing previous files, if any
                if (previousJson && Array.isArray(previousJson.files)) {
                    finalProject.files = [...previousJson.files];
                }

                if (parsedJson && Array.isArray(parsedJson.changes)) {
                    parsedJson.changes.forEach(change => {
                        if (!change.path) return;
                        
                        if (change.type === 'delete') {
                            finalProject.files = finalProject.files.filter(f => f.path !== change.path);
                        } else if (change.type === 'create' || change.type === 'modify' || change.content !== undefined) {
                            const existingIdx = finalProject.files.findIndex(f => f.path === change.path);
                            if (existingIdx >= 0) {
                                finalProject.files[existingIdx].content = change.content;
                            } else {
                                finalProject.files.push({ path: change.path, content: change.content });
                            }
                        }
                    });
                } else if (parsedJson && Array.isArray(parsedJson.files)) {
                    // Fallback just in case AI still returns the old 'files' array format
                    finalProject.files = parsedJson.files;
                }

                // Deduct credit
                let remainingCredits = req.userCredits;
                if (req.user?.role !== 'admin') {
                    const db = require('../db');
                    db.prepare('UPDATE users SET credits = credits - 1 WHERE id = ?').run(req.user.id);
                    remainingCredits -= 1;
                }

                send({ type: 'done', project: finalProject, recommendations: parsedJson.recommendations || [], credits: remainingCredits });
                res.end();
            },
            onError: (message) => {
                send({ type: 'error', message });
                res.end();
            },
        });

    } catch (error) {
        console.error('WebCreator API Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate project.' });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate project.' })}\n\n`);
            res.end();
        }
    }
});

module.exports = router;
