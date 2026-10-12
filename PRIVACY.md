# TableLyft Privacy

TableLyft 0.1 is designed for local, user-triggered table capture. It has no account, server, telemetry, ads, remote models, or cloud synchronization.

## Permissions

| Permission | Use |
| --- | --- |
| `activeTab` | Temporary access to a tab after the user invokes the extension |
| `scripting` | Inject the bundled isolated-world picker into that tab |
| `storage` | Temporary extension session captures and pending selection requests |
| `clipboardWrite` | Copy the chosen output after an explicit command |

No persistent host, browsing-history, cookie, clipboard-read, network-interception, or downloads permissions are requested.

## Captured Data

Only the selected table's rendered text matrix, its label, sanitized source page title/URL, and temporary tab/session metadata are kept. Hidden content, form-control values, nested table text, page HTML, cookies, chat, and unrelated page content are not captured. The picker temporarily lists labels/row counts of available tables in tab memory. Source URLs remove credentials, queries, and fragments; URL paths and page titles may still contain sensitive information.

Captures use browser session storage, which is not durable disk history or Chrome Sync. Stored captures expire after 30 minutes and pending selections after 10 minutes, with lazy cleanup on subsequent access. Closing a workspace removes its stored capture. Open workspace state can remain in memory until closed or discarded. Browser restart or extension reload clears session storage. Expiry is not a secure-erasure guarantee. Exports and clipboard contents follow the user's operating system/application retention rules and are not erased by TableLyft.

The extension never uploads a capture. Copy/download commands intentionally transfer the selected data to the clipboard or a local file. Users are responsible for authorization to use source data and for reviewing it before sharing. CSV formula protection is enabled by default; disabling it can make spreadsheet imports unsafe. Spreadsheet auto-formatting can change text such as dates or leading zeros.

Extension stores and package registries have their own policies. This document describes TableLyft runtime behavior, not those services.
