# Architecture

Status: implementation contract for TableLyft 0.1.

## Decisions

| Concern | Choice | Reason |
| --- | --- | --- |
| Extension build | WXT / Vite, Manifest V3 | Standard packaging and typed extension entrypoints |
| Interface | React + TypeScript + ordinary CSS | Shared UI primitives without a large component framework |
| Icons | Lucide | Consistent accessible icon controls |
| Validation | Zod | Explicit bounds at the content-script trust boundary |
| Table parsing | Native HTML table/DOM APIs | No private framework state, website API, or heuristic scraping |
| CSV / TSV | Papa Parse | Established escaping and serialization |
| State | React component state | One workspace, no need for a global state framework |
| Temporary captures | `chrome.storage.session` | Survives worker suspension without persisting across browser sessions |
| Tests | Vitest + jsdom; Playwright Chromium | Pure logic coverage plus the installed-extension workflow |
| Formatting | Biome | One fast formatter/linter |

## Boundaries

```text
Toolbar popup (trusted extension page)
  -> capture:start(tabId)
MV3 background worker
  -> inject packaged picker.js into the selected main-frame document
  -> issue a short-lived token bound to tab + document
Isolated-world picker
  -> enumerate rendered HTML tables
  -> user selects one table
  -> native DOM extraction -> bounded rectangular string matrix
  -> table:capture(token, matrix)
Background worker
  -> verify sender, document, token, bounds; consume token
  -> session capture -> open editor.html?id=<random ID>
Workspace (trusted extension page)
  -> validate stored capture -> transform -> preview
  -> user-triggered clipboard / local download
```

No MAIN-world injection, WebSocket interception, arbitrary page-state inspection, external messages, or remotely loaded code. Page content is always untrusted. React renders cell content as text, never HTML. Source links allow only HTTP(S); credentials and query/fragment data are discarded.

## Source Layout

```text
entrypoints/       background, popup, on-demand picker, workspace
src/core/          schemas, extraction, transformations, serialization
src/extension/     capture orchestration and temporary-storage adapters
src/ui/            shared branding and styles
tests/             unit tests and installed-extension tests
public/            bundled icons only
scripts/           icon generation and production-bundle checks
docs/              decisions, workflow, validation, roadmap
```

The core has no Chrome API dependencies. The extension layer has no UI rendering. The picker reads only the user-selected table. The workspace operates on a snapshot and never mutates the source page.

## Data Contract

An extracted table contains a label, rectangular string rows, and a suggested number of header rows. A stored capture adds a random ID, creation time, sanitized page title/URL, source tab ID when available, and editor tab ID. No page HTML, scripts, cookies, form values, or browsing history are stored.

Limits: 2,000 source rows, 100 columns, 50,000 expanded cells, and 1,000,000 total UTF-16 text units. Oversized tables fail explicitly rather than silently truncating. Merged cells expand their text across the covered logical cells; header labels flatten consecutive duplicate labels. Hidden rows/cells and nested tables are excluded from the selected table's text. Form controls are not read.

Only temporary browser-session storage holds captures. Worker suspension is safe. Closing the associated editor removes its stored capture. Remaining captures and pending requests are pruned on subsequent access; expired records are not accepted. Capture retention is 30 minutes; pending selection requests expire after 10 minutes. This is lazy cleanup, not a guarantee of deletion at the exact expiry instant. An already-loaded workspace can retain its in-memory snapshot until closed or discarded. Browser restart/extension reload clears session storage.

## Security And Exports

- Accept only known message shapes and fixed-size fields.
- Capture-start/sample commands come only from this extension's trusted pages.
- Capture submissions require the correct top-frame document, tab, and one-use token.
- A page cannot use bridge messages to read captures, open arbitrary URLs, or change preferences.
- Neutralize spreadsheet formula-looking fields by default for CSV/TSV; allow an explicit user choice to disable protection.
- Do not guess numbers/dates or promise spreadsheets will preserve their import formatting. CSV/TSV are text; spreadsheet auto-formatting remains an application behavior.
- No automatic exports, background scraping, telemetry, or capture logging.

## Why Not A Side Panel?

Tables need horizontal space. A full extension tab provides a stable, wide preview and avoids coupling the core workflow to a Chromium-only side-panel API. The popup starts capture; it is not the data editor.
