# Changelog

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
