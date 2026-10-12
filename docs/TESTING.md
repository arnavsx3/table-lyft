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

Verified locally on 2026-10-12 with Node 24 and Playwright Chromium:

- Biome and strict TypeScript checks pass.
- 46 Vitest tests pass across extraction, transformations, serialization, schemas, and session storage, including simultaneous capture submissions.
- Six installed-extension scenarios pass: complete capture/export, pagination, picker failure/cancellation, sample/clipboard/layout/discard, direct selection/plain-text rendering/zero columns, and closed/expired capture cleanup.
- CSV downloads are read back and parsed to compare actual output with expected values, including BOM, formula protection, selected columns, and filtered rows. A 230-row capture exports all rows, not just the 100-row preview page.
- Clipboard contents are read from the loopback fixture after actual copy commands. Clipboard read permission is granted only to the fixture origin for this test, never added to the extension manifest.
- Screenshots were inspected at 1440, 1280, 768, 390, and 320 pixels, plus the 384-pixel popup and picker. Workspace viewport overflow assertions pass. Screenshot captures use only the built-in synthetic sample.
- Production bundle verification passes: four expected permissions, no host grants/automatic content scripts/external messaging, strict CSP, required packaged files, and no matched remote executable references or dynamic code evaluation. This is a bounded static check, not a comprehensive security audit.

The checked-in [workspace screenshot](screenshots/workspace.png) shows the local sample, not a live website compatibility claim. Browser-test screenshots and reports are generated under ignored `test-results/` and `playwright-report/` directories.

### Manual Checks Still Pending

- Load the production folder in Brave. On an ordinary page, invoke the actual toolbar icon and select a table; verify the native `activeTab` grant. The automation harness substitutes a loopback-only grant for this gesture.
- Try representative public HTML tables and a page you normally use. Check hidden rows and merged headings against the source; report the URL and failure without including private captured data.
- Import downloaded CSV into Excel/Sheets, especially Unicode, leading zeros, multiline cells, and formula-looking text. Spreadsheet auto-formatting is outside TableLyft's control.
- Confirm behavior after a full browser restart and extension reload in Brave. Storage TTL/close/reload behavior is covered in unit/Chromium tests, not a manual Brave restart test.

Not claimed: Firefox compatibility, arbitrary website support, native browser-menu automation, or store publication.
