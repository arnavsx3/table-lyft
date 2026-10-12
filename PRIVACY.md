# Wingman Privacy

Version 1.2.1, October 12, 2026.

## Page Access

Wingman observes the supported page's remote-video element, stream/track identifiers, playback state, and controls to detect connections. These identifiers remain in page memory and are not persisted.

This release does not read video pixels, run appearance or gender classification, save screenshots, record media, or identify people. Video models and inference code are excluded from browser bundles. Legacy sources remain in the repository but are not part of the active runtime.

Wingman does not upload media, chat messages, identities, or browsing history. It does not intercept WebSocket, WebRTC, or fetch traffic. The website remains responsible for its own camera, microphone, network, and data processing.

## Optional Partner Data Check

The OmeTV-only page-world bridge is dormant until the check is started. The check locates the React/Redux provider under `#app` with a bounded traversal and subscribes read-only to `rouletteState.interlocutor`. It checks only own properties named `Gender`, `gender`, `Sex`, and `sex` in that partner object and its `DialogData` object. It does not inspect `ownGender` or scan chat text, user profiles, other globals, network traffic, or media. No site functions or network APIs are replaced.

Reports contain sample totals, fixed allowlisted field paths, and only recognized short gender-label strings, integers 0 through 3, or booleans. Other values are withheld. The last candidate-bearing sample replaces the previous candidate list; there is no per-person report history. The page bridge sends only this reduced report to the isolated extension, which validates and rebuilds it before display or export. Page-controlled data is not authenticated and never triggers skip actions, counter writes, or privileged operations.

Checking stops after 20 distinct partner-object samples, five minutes, a user stop, or leaving the page. Root traversal and malformed data failures produce an unavailable result, not a gender conclusion. Reports live only in the current tab's memory and reset on reload. Clicking Download saves the reduced report locally; nothing is automatically uploaded or written to extension storage. A downloaded report remains on disk until the user deletes it.

## Local Storage

Extension-local storage contains:

- Tracking, HUD display, and connection-audio preferences.
- Aggregate observed session and manual-skip counts.
- A timestamp for statistics initialization or reset.
- Preserved legacy preferences and aggregate counters, no longer used for filtering or displayed.

Storage is shared across Wingman tabs in the browser profile. There is no Wingman server, account, analytics endpoint, or cloud synchronization. Counters contain no connection identifiers, images, names, locations, or per-person history.

Reset aggregate counters through the settings panel's confirmation. Uninstalling removes local extension storage. Missing or invalid values receive defaults.

## Permissions and Links

The storage permission saves preferences and counters. Site access is restricted to OmeTV and MiniChat and their subdomains. Wingman requests no camera, microphone, browsing-history, or broad all-sites permission.

GitHub links open only when clicked; GitHub's privacy practices then apply. This policy does not replace website or browser policies.

For issues, use the [project repository](https://github.com/arnavsx3/wingman/issues). Do not attach identifiable images or chat content.
