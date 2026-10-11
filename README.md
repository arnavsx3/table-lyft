# Wingman

[![Build and tests](https://github.com/arnavsx3/wingman/actions/workflows/build.yml/badge.svg)](https://github.com/arnavsx3/wingman/actions/workflows/build.yml)

An on-device browser extension for OmeTV and MiniChat. Choose Women, Men, or Everyone; Wingman can request the next connection when a visual estimate consistently disagrees with your preference.

## What's New in 1.1

- Connection-aware cancellation prevents a delayed skip from carrying over to another partner.
- Three consecutive predictions above a configurable confidence threshold are required before acting.
- Blank video, no face, multiple faces, and inconsistent estimates stay **uncertain**. Keep them connected by default, or explicitly enable a timed skip.
- Both Women and Men preferences work; Everyone stops analysis and automatic skipping.
- Popup and isolated in-page controls show real status, errors, and retry actions.
- Settings and persistent statistics synchronize across tabs without conflicting writes.
- No traffic interception, message logging, analytics, or remote model downloads.

Visual estimates are fallible and cannot establish someone's gender identity. Model confidence is a score, not a measured accuracy guarantee. Lighting, occlusion, camera quality, and demographic bias can affect predictions. There is no guarantee of exclusively matching women or of avoiding platform restrictions.

## Install

Use Node.js **22 or newer** and npm:

```sh
git clone https://github.com/arnavsx3/wingman.git
cd wingman
npm ci
npm run build
```

For Chrome, Brave, Edge, or other compatible Chromium browsers:

1. Open the browser's extensions page, such as `chrome://extensions`.
2. Enable Developer mode and choose **Load unpacked**.
3. Select `dist/chrome-mv3`.
4. Refresh any already-open OmeTV or MiniChat tab.

For Firefox 109 or newer:

```sh
npm run build:firefox
```

Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox-mv3/manifest.json`. Allow access to the supported sites when Firefox asks. Temporary installs end when Firefox restarts; regular distribution requires Mozilla signing. Both browser targets use Manifest V3.

Successful [GitHub Actions runs](https://github.com/arnavsx3/wingman/actions/workflows/build.yml) also provide downloadable Chrome and Firefox ZIP artifacts. Extract the Chrome ZIP before loading it unpacked. These are development builds, not signed store releases.

## Controls

Open the extension popup to change the preference, skip delay, confidence threshold, uncertainty timeout, in-page controls, or match sound. Changes apply to open supported tabs. In-page pause/resume and **Alt+W** toggle filtering; the shortcut is ignored while entering chat text.

Default behavior:

| Setting | Default |
| --- | --- |
| Preference | Women |
| Skip delay | 300-650 ms |
| Prediction threshold | 85%, across three consistent frames |
| Uncertain matches | Keep connected |
| Uncertainty wait | 8 seconds when timed skipping is enabled |
| In-page controls / match sound | Enabled |

The delay starts after detection. A one-second minimum separates automatic Next requests. Wingman never automatically starts a chat, reconnects after Stop, or retries a click against a later partner. If Next is unavailable, use the retry control or skip manually. Sound depends on the browser allowing audio playback.

Statistics persist until **Reset all** or extension removal. Skipped counts automatic Next requests successfully dispatched to an available control; it does not certify a server-confirmed transition. Kept counts a confident preferred match once per detected connection. Uncertain keeps and manual actions do not inflate these counters. Uncertain skips have their own counter and never count as male skips. Existing 1.0 settings and statistics are migrated on read.

## Development and Checks

```sh
npm run dev             # Chromium development browser
npm run dev:firefox     # Firefox MV3 development browser
npm run check           # Type-check application, config, and tests; run regression suite
npm run build
npm run build:firefox
npm run verify:bundles  # Verify permissions, scripts, versions, and model shard sizes
npx playwright install chromium
npm run test:e2e        # Load the actual Chrome extension against a local OmeTV fixture
npm run zip
npm run zip:firefox
```

Production builds are in `dist/`, not `.output/`. ZIP names include the version and target browser. Browser tests use an isolated temporary profile, a synthetic video stream, and intercepted fixture pages; they do not access a camera or connect to strangers. Screenshots and failure traces are saved in `test-results/` and uploaded by CI.

## Architecture

| Module | Responsibility |
| --- | --- |
| `entrypoints/background.ts` | Serialized settings/statistics mutations and badge updates |
| `entrypoints/content.ts` | Page lifecycle, subscriptions, shortcuts, and controls |
| `modules/ometv/session.ts` | Connection identity from remote video, stream, tracks, and playback state |
| `modules/ometv/vision.ts` | Bundled model loading and sequential inference |
| `modules/ometv/decision.ts` | Filter policy and prediction consensus |
| `modules/ometv/controller.ts` | Cancellable per-connection decisions and statistics |
| `modules/ometv/skipper.ts` | Validated Next controls, cooldown, and match audio |
| `modules/preferences.ts` | Defaults, validation, and migration |
| `modules/ometv/hud.tsx` | Responsive controls isolated in a shadow root |

The existing [FaceAPI](https://github.com/vladmandic/face-api) inference stack is retained with bundled Tiny Face Detector and Age/Gender weights. Its upstream repository is archived; future model replacement should be evaluated with representative, consented test data rather than assuming higher confidence means higher accuracy. Only the gender estimate is used; age output is neither logged nor stored.

## Troubleshooting and Limits

- **Refresh this page to connect Wingman:** reload the supported tab after installing or updating the extension; check site access in extension settings.
- **Models unavailable / video analysis failed:** use Retry detection. Filtering does not claim to be ready after a model failure.
- **Uncertain match kept:** no stable single-face prediction reached the threshold in time. Lowering confidence increases the chance of a wrong decision.
- **Next control unavailable:** the control is hidden, disabled, or the site layout changed. No keyboard fallback or arbitrary last-button click is attempted.
- Background tabs suspend new inference. Returning to the tab gives detection a fresh uncertainty window.
- OmeTV's current remote-video layout is inspected, but actual matchmaking and Firefox runtime behavior still require manual smoke testing. MiniChat must expose the same remote-video IDs and playback state; a different layout is currently left idle.
- Sites can change layouts or reuse connections in ways that provide no observable stream, track, or playback transition. Such transitions cannot be reliably distinguished by a DOM-only extension.

## Privacy and License

Frames are processed transiently in your browser. Wingman stores preferences and aggregate counters locally. See [PRIVACY.md](PRIVACY.md) for details. The Firefox manifest declares no transmitted data using [Mozilla's built-in data consent format](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

[MIT](LICENSE). Third-party notices are included in production bundles. Wingman is not affiliated with OmeTV or MiniChat; use is subject to the platform's rules.
