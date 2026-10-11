# Wingman Privacy

Version 1.1.0, October 12, 2026.

## Video Processing

Wingman reads the remote video element on supported OmeTV and MiniChat pages to run an appearance-based estimate locally. Frames are used transiently by the model; Wingman does not save screenshots, record video, build face profiles, or identify people. The existing model also produces an age output internally, which Wingman neither logs nor persists.

The model and weights ship inside the extension. Wingman does not upload frames, predictions, chat messages, identities, or browsing history. It does not intercept WebSocket, WebRTC, or fetch traffic. The website itself remains responsible for its own camera, microphone, network, and data processing behavior.

## Local Storage

Extension-local storage contains:

- Filtering preferences, confidence threshold, delay, uncertainty behavior, and display/audio preferences.
- Aggregate counts of automatically requested skips, confidently kept matches, male estimates skipped, female estimates kept, and uncertain skips.
- The timestamp when statistics were initialized or last reset.

Storage is shared across Wingman tabs in the same browser profile. There is no Wingman server, account, analytics endpoint, or cloud synchronization. Counters do not contain connection identifiers, images, names, countries, or per-person history. Connection IDs used to cancel stale work exist only in page memory.

Reset the aggregate counters through the popup's reset confirmation. Uninstalling the extension removes its local extension storage. Defaults are applied if saved values are missing or invalid.

## Permissions and Links

The storage permission saves preferences and counters. Site access is restricted to OmeTV and MiniChat and their subdomains. Model resources are exposed only to those matching sites so the content script can load them. Wingman requests no additional camera, microphone, browsing-history, or broad all-sites permission.

GitHub links open only when clicked. Normal requests to GitHub then follow GitHub's privacy practices. This policy describes Wingman's behavior and does not replace the policies of websites you visit or your browser.

For questions or issues, use the [project repository](https://github.com/arnavsx3/wingman/issues). Avoid attaching identifiable images or chat content to public reports.
