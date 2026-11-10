# Security

DE Lab has **no backend**: learning data stays in the user's browser (IndexedDB); learner code runs in sandboxed Web Workers (SQLite WASM, Pyodide). The optional AI coach sends requests directly from the browser to Anthropic using the user's own API key, which is stored only locally and excluded from backups.

## Reporting a vulnerability
Please **don't open a public issue**. Use GitHub's *Security → Report a vulnerability* (private advisory) on this repository. Include steps to reproduce and impact. We aim to respond within 7 days.

Areas of particular interest: escaping of user-generated notes (rendered Markdown), the PDF export, the local launcher (`launcher/serve.ps1`), and handling of the API key.
