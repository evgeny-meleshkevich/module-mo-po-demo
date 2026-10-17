# PDF.js

Vendored `pdfjs-dist` 6.4.299 from https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz.
Upstream: https://github.com/mozilla/pdf.js (Apache-2.0; see LICENSE).

Only the reader and worker are shipped. Both are served from this application,
without CDN requests. `static/candidate-pdf.mjs` reads the user-selected file as
bytes in the browser and extracts text from page 1. It does not render the PDF,
execute embedded PDF scripts, upload bytes, or fall back to a server parser.
