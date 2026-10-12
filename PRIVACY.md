# Wingman Privacy

Version 1.3.0, October 12, 2026.

## Page Access

Wingman observes the supported page's remote-video element, stream/track identifiers, playback state, and controls to detect connections. These identifiers remain in page memory and are not persisted.

This release does not read video pixels, run appearance or gender classification, save screenshots, record media, or identify people. Video models and inference code are excluded from browser bundles. Legacy sources remain in the repository but are not part of the active runtime.

Wingman does not upload media, chat messages, identities, or browsing history. It does not intercept WebSocket, WebRTC, or fetch traffic. The website remains responsible for its own camera, microphone, network, and data processing.

## Optional Partner Data Check

The OmeTV-only diagnostic check is dormant until started, independently of the experimental mode described below. The check locates the React/Redux provider under `#app` with a bounded traversal and subscribes read-only to `rouletteState.interlocutor`. It checks only own properties named `Gender`, `gender`, `Sex`, and `sex` in that partner object and its `DialogData` object. It does not inspect `ownGender` or scan chat text, user profiles, other globals, network traffic, or media. No site functions or network APIs are replaced.

Reports contain sample totals, fixed allowlisted field paths, and only recognized short gender-label strings, integers 0 through 3, or booleans. Other values are withheld. The last candidate-bearing sample replaces the previous candidate list; there is no per-person report history. The page bridge sends only this reduced report to the isolated extension, which validates and rebuilds it before display or export. Diagnostic reports are not authenticated and never trigger skip actions, counter writes, or privileged operations.

Checking stops after 20 distinct partner-object samples, five minutes, a user stop, or leaving the page. Root traversal and malformed data failures produce an unavailable result, not a gender conclusion. Reports live only in the current tab's memory and reset on reload. Clicking Download saves the reduced report locally; nothing is automatically uploaded or written to extension storage. A downloaded report remains on disk until the user deletes it.

## Experimental Metadata Mode

Experimental auto-skip is off by default. When both it and Session tracking are on, the isolated extension requests fresh snapshots of the exact root `rouletteState.interlocutor.Gender` field in the OmeTV desktop store. Only numeric `1` and `2` are interpreted, under an explicitly unverified mapping assumption. No diagnostic report, text alternative, voice, face, or other media classifier is used.

The reader also checks the established roulette state and current remote stream fingerprint, and temporarily compares the connection's `PairId` to produce a tab-local increasing sequence. Raw pair IDs stay in page memory; they are not sent across the bridge, persisted, exported, or uploaded. Stream fingerprints are exchanged only locally between the isolated content script and page bridge to bind a response to active media. Returned snapshots contain only state, a local sequence, and code `1`, `2`, or unknown. Only the latest pair decision is retained, not per-person history.

Valid snapshots may cause a visible Next control click or an aggregate prototype-counter update while the mode is enabled. The bridge and page state are not authenticated: request IDs correlate replies but do not establish a trust boundary against the host page. The source/provenance and server meaning of the received Gender field remain unverified. The mode is a code-based prototype, not verified gender identification. Missing or conflicting data is left unchanged. Pause, Stop, manual Next, disabling the mode, and teardown cancel pending decisions.

## Local Storage

Extension-local storage contains:

- Tracking, experimental-mode enablement, skip-delay, HUD display, and connection-audio preferences.
- Aggregate experimental code-2 connection and transition-confirmed automatic code-1 skip counts.
- Preserved aggregate observed session and manual-skip counts, no longer displayed.
- A timestamp for statistics initialization or reset.
- Preserved legacy preferences and aggregate counters, no longer used for filtering or displayed.

Storage is shared across Wingman tabs in the browser profile. There is no Wingman server, account, analytics endpoint, or cloud synchronization. Counters contain no connection identifiers, images, names, locations, or per-person history.

Reset aggregate counters through the settings panel's confirmation. Uninstalling removes local extension storage. Missing or invalid values receive defaults.

## Permissions and Links

The storage permission saves preferences and counters. Site access is restricted to OmeTV and MiniChat and their subdomains. Wingman requests no camera, microphone, browsing-history, or broad all-sites permission.

GitHub links open only when clicked; GitHub's privacy practices then apply. This policy does not replace website or browser policies.

For issues, use the [project repository](https://github.com/arnavsx3/wingman/issues). Do not attach identifiable images or chat content.
