// PDF export: builds a clean, print-styled document (always light theme, selectable text, page breaks)
// in a hidden frame and opens the system print dialog with "Save as PDF". The document title becomes the file name.
export interface PdfSection { heading: string; kicker?: string; html: string; pageBreak?: boolean }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const CSS = `
@page { size: A4; margin: 16mm 15mm 18mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.55 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; color: #1b1f2a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { border-bottom: 3px solid #4f46e5; padding-bottom: 10px; margin-bottom: 18px; }
.cover .brand { font-size: 9pt; color: #4f46e5; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.cover h1 { font-size: 20pt; margin: 4px 0 2px; }
.cover .sub { color: #5b6275; font-size: 9.5pt; }
section { margin-bottom: 14px; }
section.break { page-break-before: always; break-before: page; }
.kicker { font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #4f46e5; font-weight: 700; margin: 0 0 2px; }
h2.sec { font-size: 14pt; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #dfe2ea; }
h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; line-height: 1.25; }
.content h2 { font-size: 12.5pt; margin: 14px 0 6px; } .content h3 { font-size: 11pt; margin: 12px 0 4px; }
p { margin: 0 0 6px; } ul, ol { margin: 0 0 7px; padding-left: 18px; } li { margin: 1px 0; }
code { font-family: "Cascadia Code", Consolas, monospace; font-size: 9pt; background: #f1f2f6; padding: 0 3px; border-radius: 3px; }
pre { background: #f5f6f9; border: 1px solid #e1e4ec; border-radius: 6px; padding: 8px 10px; font-size: 8.6pt; line-height: 1.45; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: inherit; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 0 0 8px; page-break-inside: avoid; }
th, td { border: 1px solid #d9dce5; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f1f2f7; }
blockquote { margin: 0 0 8px; padding: 2px 10px; border-left: 3px solid #cfd3de; color: #4a5163; }
.callout { border: 1px solid #dfe2ea; border-left: 4px solid #1d7fd6; background: #f2f8fe; border-radius: 6px; padding: 6px 10px; margin: 0 0 8px; page-break-inside: avoid; }
.callout-title { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em; font-weight: 700; color: #1d7fd6; }
.callout-tip { border-left-color: #0f9d6b; background: #effaf4; } .callout-tip .callout-title { color: #0f9d6b; }
.callout-warn, .callout-mistake { border-left-color: #d9363e; background: #fdf1f1; } .callout-warn .callout-title, .callout-mistake .callout-title { color: #d9363e; }
.callout-interview { border-left-color: #4f46e5; background: #f2f2fe; } .callout-interview .callout-title { color: #4f46e5; }
.callout-why, .callout-real { border-left-color: #c27c0e; background: #fff8ea; } .callout-why .callout-title, .callout-real .callout-title { color: #a86a08; }
.callout-think { border-left-color: #0d9488; } .callout-perf { border-left-color: #e25a1c; }
.hljs-keyword { color: #7c3aed; } .hljs-string { color: #0f7b4e; } .hljs-number, .hljs-literal { color: #c2410c; }
.hljs-comment { color: #7d8699; font-style: italic; } .hljs-title, .hljs-built_in { color: #1d5fd1; } .hljs-type, .hljs-params { color: #b45309; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.card { border: 1px solid #dfe2ea; border-radius: 6px; padding: 6px 8px; page-break-inside: avoid; break-inside: avoid; }
.card .q { font-weight: 600; margin-bottom: 3px; } .card .a { color: #3b4254; }
.note { border: 1px solid #e3e6ee; border-radius: 6px; padding: 7px 10px; margin-bottom: 8px; page-break-inside: avoid; }
.note .meta { font-size: 8pt; color: #7a8296; margin-bottom: 3px; }
mark { background: #fde68a; padding: 0 2px; }
.footer { margin-top: 20px; font-size: 8pt; color: #8a91a3; border-top: 1px solid #e3e6ee; padding-top: 6px; }
a { color: #3f37c9; text-decoration: none; }
`

export function exportPdf(title: string, subtitle: string, sections: PdfSection[]) {
  const body = sections.map((s, i) => `
    <section class="${s.pageBreak && i > 0 ? 'break' : ''}">
      ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ''}
      <h2 class="sec">${esc(s.heading)}</h2>
      <div class="content">${s.html}</div>
    </section>`).join('')
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
    <div class="cover"><div class="brand">DE Lab · Notes</div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)} · exported ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
    ${body}
    <div class="footer">Generated from DE Lab — your personal Data Engineering workspace.</div>
  </body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' })
  document.body.appendChild(frame)
  const w = frame.contentWindow!
  w.document.open(); w.document.write(doc); w.document.close()
  const cleanup = () => setTimeout(() => frame.remove(), 1000)
  w.addEventListener('afterprint', cleanup)
  // let fonts/layout settle, then open the dialog (choose "Save as PDF")
  setTimeout(() => { w.focus(); w.print(); setTimeout(cleanup, 60000) }, 350)
}

export const flashcardsHtml = (cards: { q: string; a: string }[]) =>
  `<div class="cards">${cards.map((c) => `<div class="card"><div class="q">${c.q}</div><div class="a">${c.a}</div></div>`).join('')}</div>`
