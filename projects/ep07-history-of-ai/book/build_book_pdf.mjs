import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BOOK_DIR = path.resolve('projects/ep07-history-of-ai/book');
const MD_FILE = path.join(BOOK_DIR, 'HOW_WE_TAUGHT_SAND_TO_THINK.md');
const HTML_FILE = path.join(BOOK_DIR, 'book.html');
const PDF_OUTPUT = path.resolve('exports/How-We-Taught-Sand-to-Think-Companion-Book.pdf');

const mdContent = fs.readFileSync(MD_FILE, 'utf8');

function markdownToHtml(md) {
  let html = md;

  // Escape HTML characters in code blocks first
  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const id = `___CODE_BLOCK_${codeBlocks.length}___`;
    codeBlocks.push(`<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()}</code></pre>`);
    return id;
  });

  // Math Blocks
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (m, math) => {
    return `<div class="math-block">\\[${math.trim()}\\]</div>`;
  });

  // Inline Math
  html = html.replace(/\$([^\$\n]+)\$/g, (m, math) => {
    return `<span class="math-inline">\\(${math.trim()}\\)</span>`;
  });

  // Headers
  html = html.replace(/^# (.*$)/gim, '<h1 class="chapter-title">$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="section-title">$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="subsection-title">$1</h3>');

  // Images
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    const absSrc = path.isAbsolute(src) ? src : path.join(BOOK_DIR, src);
    return `<figure class="book-figure"><img src="file://${absSrc}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`;
  });

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Horizontal Rules
  html = html.replace(/^---$/gim, '<hr class="book-divider" />');

  // Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<div class="table-container"><table class="book-table"><thead>';
        const headers = line.split('|').slice(1, -1).map(h => `<th>${h.trim()}</th>`).join('');
        tableHtml += `<tr>${headers}</tr></thead><tbody>`;
        // skip separator line if next
        if (i + 1 < lines.length && lines[i + 1].includes('---')) {
          i++;
        }
      } else {
        const cells = line.split('|').slice(1, -1).map(c => `<td>${c.trim()}</td>`).join('');
        tableHtml += `<tr>${cells}</tr>`;
      }
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += '</tbody></table></div>';
        newLines.push(tableHtml);
      }
      newLines.push(lines[i]);
    }
  }
  if (inTable) {
    tableHtml += '</tbody></table></div>';
    newLines.push(tableHtml);
  }

  html = newLines.join('\n');

  // Unordered Lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^[•] (.*$)/gim, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/gim, '<ul class="book-list">$1</ul>');

  // Paragraphs
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') ||
        p.startsWith('<figure') || p.startsWith('<div') || p.startsWith('<pre') ||
        p.startsWith('<blockquote') || p.startsWith('<hr') || p.startsWith('<ul')) {
      return p;
    }
    return `<p>${p}</p>`;
  }).join('\n\n');

  // Restore code blocks
  codeBlocks.forEach((cb, idx) => {
    html = html.replace(`___CODE_BLOCK_${idx}___`, cb);
  });

  return html;
}

const bodyHtml = markdownToHtml(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>How We Taught Sand to Think — Programs Magic Field Guide</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body);"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;800&display=swap');

    @page {
      size: A4;
      margin: 18mm 16mm 22mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: 'JetBrains Mono', monospace;
        font-size: 9pt;
        color: #64748b;
      }
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0B0F19;
      color: #E2E8F0;
      line-height: 1.68;
      font-size: 11pt;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    .book-container {
      max-width: 820px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Cover Page */
    h1.chapter-title:first-of-type {
      font-size: 32pt;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #FACC15;
      margin-top: 40px;
      margin-bottom: 12px;
      line-height: 1.15;
      text-transform: uppercase;
    }

    h2.section-title {
      font-size: 18pt;
      font-weight: 800;
      color: #38BDF8;
      border-bottom: 2px solid rgba(56, 189, 248, 0.25);
      padding-bottom: 8px;
      margin-top: 42px;
      margin-bottom: 16px;
      page-break-after: avoid;
    }

    h3.subsection-title {
      font-size: 13.5pt;
      font-weight: 700;
      color: #FDE047;
      margin-top: 24px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 14px;
      color: #CBD5E1;
      text-align: justify;
    }

    strong {
      color: #FFFFFF;
      font-weight: 700;
    }

    em {
      color: #FEF08A;
      font-style: italic;
    }

    code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(30, 41, 59, 0.8);
      color: #38BDF8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5pt;
      border: 1px solid rgba(56, 189, 248, 0.25);
    }

    pre {
      background: #0F172A;
      border: 1.5px solid rgba(56, 189, 248, 0.3);
      border-radius: 8px;
      padding: 14px 18px;
      overflow-x: auto;
      margin: 18px 0;
      page-break-inside: avoid;
    }

    pre code {
      background: none;
      border: none;
      padding: 0;
      color: #E2E8F0;
      font-size: 9.5pt;
      line-height: 1.5;
    }

    blockquote {
      border-left: 4px solid #FACC15;
      background: rgba(30, 41, 59, 0.5);
      padding: 12px 18px;
      margin: 18px 0;
      border-radius: 0 8px 8px 0;
      color: #FEF08A;
      font-style: italic;
      page-break-inside: avoid;
    }

    /* Figures & Screenshots */
    figure.book-figure {
      margin: 22px 0;
      text-align: center;
      page-break-inside: avoid;
    }

    figure.book-figure img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      border: 1.5px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
    }

    figure.book-figure figcaption {
      font-size: 9pt;
      color: #94A3B8;
      margin-top: 8px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Tables */
    .table-container {
      width: 100%;
      margin: 20px 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }

    table.book-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      background: rgba(15, 23, 42, 0.85);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(56, 189, 248, 0.25);
    }

    table.book-table th {
      background: #1E293B;
      color: #FACC15;
      font-weight: 700;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 2px solid rgba(56, 189, 248, 0.3);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5pt;
    }

    table.book-table td {
      padding: 10px 14px;
      border-bottom: 1px solid rgba(51, 65, 85, 0.5);
      color: #E2E8F0;
    }

    table.book-table tr:last-child td {
      border-bottom: none;
    }

    hr.book-divider {
      border: none;
      height: 1.5px;
      background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.4), transparent);
      margin: 35px 0;
    }

    ul.book-list {
      padding-left: 24px;
      margin: 12px 0 18px 0;
    }

    ul.book-list li {
      margin-bottom: 6px;
      color: #CBD5E1;
    }

    .math-block {
      text-align: center;
      margin: 16px 0;
      font-size: 12pt;
      color: #FDE047;
    }

    /* Print Specific Tweaks */
    @media print {
      body {
        background-color: #07090E !important;
        color: #E2E8F0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .book-container {
        padding: 0;
      }
      h2.section-title {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="book-container">
    ${bodyHtml}
  </div>
</body>
</html>`;

fs.writeFileSync(HTML_FILE, fullHtml, 'utf8');
console.log(`✓ Generated book HTML: ${HTML_FILE}`);

console.log('Compiling publication-grade PDF using Google Chrome headless...');
try {
  execSync(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --user-data-dir=/tmp/chrome-book-pdf --allow-file-access-from-files --print-to-pdf="${PDF_OUTPUT}" "${HTML_FILE}"`, { stdio: 'inherit' });
  console.log(`\n🎉 Companion Book PDF successfully compiled!`);
  console.log(`PDF Target: ${PDF_OUTPUT}`);
} catch (err) {
  console.error('Error generating PDF:', err);
  process.exit(1);
}

