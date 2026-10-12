# Changelog

## 1.3.0 - 2026-10-12

### Added

- Off-by-default experimental OmeTV desktop auto-skip using the unverified assumption that received `interlocutor.Gender` matches outgoing codes: female `2`, male/couple `1`. Unknown values are never skipped.
- Fresh exact-field snapshots bound to established partner state, tab-local pair sequence and active remote media; no retained diagnostic values or media classification.
- Stable decisions, configurable automatic delay, action spacing, stale-response cancellation, and one automatic request per pair without repeat-clicking failures.
- Fresh Girls connected and Male/couple skipped counters, visible unverified-mapping notices, and transition-confirmed automatic-skip accounting. Historical counters are preserved, not relabeled.
- Unit and installed-extension coverage for current-partner snapshots, bridge validation, unknown/conflicting data, deduplication, failure, Stop, pause, mode changes, persistence, reset and layout.

### Changed

- Replace visible Sessions/Skipped totals with experimental code-based activity. Manual Next remains available but does not increase prototype counters.
- Keep automatic skipping off unless the user explicitly enables the metadata prototype. Media classification is never enabled or shipped.

## 1.2.1 - 2026-10-12

### Added

- Opt-in OmeTV partner-state diagnostic check in the HUD and settings panel, with explicit unavailable, waiting, no-field-seen, and unverified-candidate results.
- Read-only React/Redux subscription restricted to the partner object and `DialogData`; no traffic interception, media access, automatic skipping, or counter mutations.
- Bounded field/value allowlists, same-window/origin/request message validation, a 20-sample/five-minute cap, cleanup, and sanitized local report downloads.
- Unit and installed-extension tests for privacy, opt-in behavior, lifecycle, report exports, unchanged counters, unavailable state, and responsive diagnostic layouts.

### Changed

- Require Firefox 128+ for the page-world bridge. Existing manual controls and counters remain unchanged; gender filtering is not implemented.

## 1.2.0 - 2026-10-12

### Changed

- Switch the active runtime to manual session controls; video classification and automatic filtering are no longer invoked or shipped in browser bundles.
- Count connections independently of filtering, with migration that preserves existing aggregate counters.
- Count HUD Next, site Next, and native keyboard requests only after an observable connection transition; ignore failed clicks, Stop, and unsolicited disconnects.
- Recognize live remote streams even when the site's playback CSS class differs, while rejecting searching/stopped states and missing media.
- Enlarge the responsive HUD to 420 pixels, with larger controls, session/skip counters, a live chat timer, and a full-width Next button.
- Synchronize initial statistics without overwriting newer storage events, and update both popup and HUD across tabs and resets.

## 1.1.1 - 2026-10-12

### Fixed

- Prevent the settings panel from collapsing to the browser action's initial narrow width.
- Use a 520-pixel settings panel with two-column detection controls and preferences.
- Verify native browser action dimensions, including the expanded uncertainty settings.

## 1.1.0 - 2026-10-12

### Fixed

- Cancel delayed skips on pause, preference changes, manual actions, disconnection, stream replacement, or teardown.
- Reject inference results from previous connections and prevent overlapping frame processing.
- Implement the Men preference and stop inference in Everyone mode.
- Treat missing, ambiguous, and low-confidence faces as unknown, rather than fabricating male detections.
- Remove unverified keyboard fallbacks and repeat-click timers that could skip a subsequent partner.
- Validate visible, enabled Next controls, including OmeTV's parent disabled classes and localized translation markers.
- Serialize mutations in the background to preserve simultaneous settings and statistics updates.
- Clean up storage listeners, observers, timers, HUD roots, and pending actions.
- Report model and action failures without claiming detection is ready.
- Build Firefox explicitly as Manifest V3 and correct documented output paths.

### Added

- Three-reading prediction consensus, configurable confidence, and optional timed skipping of uncertain connections.
- Live page status and explicit detection retry in the popup and shadow-root HUD.
- Accessible controls, immediate switch feedback, narrow-layout checks, and confirmed statistics reset.
- Validation and migration for stored settings and counters.
- Unit regression tests, installed-extension Chromium tests using the real bundled models, and model/manifest validation.
- CI integration checks, browser diagnostics, versioned ZIPs, and privacy/model documentation.

### Removed

- Unused network interception and raw site-traffic logging.
- Unused metadata/DOM gender detector and its unsafe substring matching.
- Misleading anti-ban/anti-detection claims and the nonfunctional auto-reconnect preference.
