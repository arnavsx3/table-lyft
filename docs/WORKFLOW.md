# Workflow

## Capture

1. User opens a supported HTTP(S) page and invokes TableLyft.
2. Popup shows the current page and a Select table command.
3. User explicitly starts selection; temporary tab access permits one packaged script injection.
4. A shadow-root picker lists loaded, rendered HTML tables. Hover/focus highlights a table; clicking its item or the table selects it. Escape/Cancel removes the picker.
5. No table found, unsupported page, detached table, exceeded limits, and expired access have explicit error states. No table is selected automatically.
6. Selection creates a bounded snapshot. The background validates it, stores it temporarily, and opens a workspace tab.

## Prepare

The workspace shows the source, captured row count, column controls, and a scrollable data grid. Users can choose heading rows, rename or exclude columns, remove empty rows, filter visible output, and sort. The preview and export must use the same transformed dataset. Reset restores the original capture configuration, not a new page scrape.

An empty filter result is a valid state and never falls back to exporting all rows. Excluding every column disables export. Header controls are bounded by the capture's rows. Sorting is stable and compares displayed strings naturally; no source values are converted to numeric/date types.

## Export

- Copy spreadsheet: tab-separated, formula-protected text.
- Download CSV: correctly escaped fields and line endings, configurable separator, UTF-8 BOM.
- Copy Markdown: escaped pipes and HTML-sensitive text, multiline cells represented safely.
- Include headings and formula protection are visible choices. Source URL is displayed separately, never silently appended to data.

Clipboard failure keeps the dataset and offers a clear failure state. Downloads are generated locally from a Blob and require no downloads permission. There is no upload/share service.

## End

Discard removes the temporary capture and clears the workspace's in-memory data. Closing the editor removes its capture through the background tab lifecycle handler. A missing/expired capture shows an empty state with an Open sample command. Re-capture requires another explicit toolbar invocation.
