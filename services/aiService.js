/**
 * aiService.js
 * Unified AI service that routes to Gemini or DeepSeek.
 * All API keys are read from environment variables — never exposed to the frontend.
 *
 * Stream format emitted via onChunk / onDone / onError callbacks:
 *   onChunk(text)          — incremental text
 *   onDone()               — generation complete
 *   onError(message)       — error string
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Gemini ────────────────────────────────────────────────────────────────────
async function streamGemini({ prompt, systemPrompt, history = [], generationConfig = {}, onChunk, onDone, onError }) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                ...generationConfig,
            },
        });

        // Build Gemini chat history
        const geminiHistory = [];
        if (Array.isArray(history)) {
            for (const msg of history.slice(-10)) {
                if (msg.role === 'user' || msg.role === 'model') {
                    geminiHistory.push({ role: msg.role, parts: [{ text: msg.content || msg.text || '' }] });
                }
            }
        }

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessageStream(prompt);

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) onChunk(text);
        }
        onDone();
    } catch (err) {
        console.error('[aiService] Gemini error:', err.message);
        onError(err.message || 'Gemini API error.');
    }
}

// ── DeepSeek (OpenAI-compatible API) ─────────────────────────────────────────
async function streamDeepSeek({ prompt, systemPrompt, history = [], onChunk, onDone, onError }) {
    try {
        if (!process.env.DEEPSEEK_API_KEY) {
            return onError('DeepSeek API key not configured. Add DEEPSEEK_API_KEY to your .env file.');
        }

        // Build messages array (OpenAI format)
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

        if (Array.isArray(history)) {
            for (const msg of history.slice(-10)) {
                const role = msg.role === 'model' ? 'assistant' : 'user';
                messages.push({ role, content: msg.content || msg.text || '' });
            }
        }
        messages.push({ role: 'user', content: typeof prompt === 'string' ? prompt : prompt });

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 8192,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            return onError(`DeepSeek API error: ${response.status} — ${err}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(trimmed.substring(6));
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) onChunk(delta);
                } catch {
                    // Ignore malformed chunks
                }
            }
        }

        onDone();
    } catch (err) {
        console.error('[aiService] DeepSeek error:', err.message);
        onError(err.message || 'DeepSeek API error.');
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * stream({ model, prompt, systemPrompt, history, generationConfig, onChunk, onDone, onError })
 * model: 'gemini' | 'deepseek'  (defaults to 'gemini')
 */
function stream(options) {
    const { model = 'gemini', ...rest } = options;
    if (model === 'deepseek') return streamDeepSeek(rest);
    return streamGemini(rest);
}

module.exports = { stream };
