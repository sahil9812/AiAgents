/**
 * Extracts code blocks from a markdown string.
 * Returns { html, css, js } strings.
 */
export function extractCodeBlocks(markdown) {
    const regex = /```(\w*)\n?([\s\S]*?)```/g;
    let match;
    const blocks = { html: '', css: '', js: '' };

    while ((match = regex.exec(markdown)) !== null) {
        const lang = (match[1] || '').toLowerCase().trim();
        const code = match[2] || '';
        if (lang === 'html') blocks.html += code;
        else if (lang === 'css') blocks.css += code;
        else if (lang === 'js' || lang === 'javascript') blocks.js += code;
    }
    return blocks;
}

/**
 * Returns true if the markdown contains previewable code (HTML, CSS, or JS).
 */
export function hasPreviewableCode(markdown) {
    const blocks = extractCodeBlocks(markdown);
    return !!(blocks.html || blocks.css || blocks.js);
}

/**
 * Builds a full standalone HTML document from extracted code blocks.
 * Injects <style> and <script> into the HTML or creates a wrapper page.
 */
export function buildPreviewHtml(markdown) {
    const { html, css, js } = extractCodeBlocks(markdown);
    if (!html && !css && !js) return null;

    const styleTag = css ? `<style>\n${css}\n</style>` : '';
    const scriptTag = js ? `<script>\n${js}\n</script>` : '';

    if (html) {
        let doc = html;

        // If it's a full HTML document, inject into head/body
        if (/<html[\s>]/i.test(doc)) {
            if (/<\/head>/i.test(doc) && css) {
                doc = doc.replace(/<\/head>/i, `${styleTag}\n</head>`);
            } else if (css) {
                doc = doc.replace(/<body[\s>]/i, `${styleTag}\n<body>`);
            }
            if (/<\/body>/i.test(doc) && js) {
                doc = doc.replace(/<\/body>/i, `${scriptTag}\n</body>`);
            } else if (js) {
                doc += scriptTag;
            }
            return doc;
        }

        // Partial HTML — wrap it
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${styleTag}
</head>
<body>
${html}
${scriptTag}
</body>
</html>`;
    }

    // No HTML block — CSS/JS only
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  ${styleTag}
</head>
<body>
${scriptTag}
</body>
</html>`;
}
