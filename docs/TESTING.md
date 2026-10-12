# Testing

## Verification Gates

1. Core extraction: headings, row groups, `rowspan=0`, merged cells, irregular rows, hidden content, nested tables, excluded form controls, empty/oversized tables, and detached selections.
2. Transformations: headings, unique names, column selection, empty rows, filter-to-zero, stable sorting, reset semantics, and no mutation of snapshots.
3. Serialization: CSV delimiters, quotes/newlines, tabs, Unicode, formula protection, Markdown escaping, and empty data.
4. Trust boundary: schema limits, invalid/expired tokens, wrong tab/document/frame, duplicate submissions, untrusted commands, and temporary capture cleanup.
5. Installed Chromium: popup/sample, picker -> background -> editor, column/filter/export agreement, downloaded bytes, cancellation, no-table errors, reload, discard, and desktop/narrow screenshots.
6. Production artifact: only declared permissions, no host grants/auto content scripts, no remote code or network backend, all entrypoints/icons present.

These are the intended validation cases; release verification below records what actually ran. A test plan is not a claim that every case passed.

## Browser Harness

Playwright uses a temporary profile and a copy of the built extension with a loopback-only host grant. That grant replaces the native toolbar `activeTab` gesture for automation and is never included in production artifacts. Capture requests originate from a trusted extension page; table selection and editing use real UI events. This validates orchestration and rendering, not native toolbar permission granting in Brave. Fixtures are synthetic and contain no real user data.

Manual release checks still include loading the production build in Brave, using the toolbar on representative real pages, and checking CSV import in Excel/Sheets. Record failures rather than expanding the compatibility claim.

## Release Verification

Implementation in progress. Test counts, screenshots, and manual compatibility observations will be recorded after execution.
