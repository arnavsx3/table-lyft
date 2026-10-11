# Wingman

[![Build and tests](https://github.com/arnavsx3/wingman/actions/workflows/build.yml/badge.svg)](https://github.com/arnavsx3/wingman/actions/workflows/build.yml)

Manual session controls for OmeTV and MiniChat, with persistent connection/skip counters and an isolated in-page HUD.

## Version 1.2

The active runtime now uses manual controls. It does not inspect video pixels, infer gender, or automatically filter people. Filtering on explicit self-reported partner information is not implemented; no suitable field is currently integrated.

- Sessions counts observed remote connections once while tracking is enabled.
- Skipped counts a manual Next intent followed by an observable disconnect or stream replacement within three seconds.
- HUD Next, site Next, and the site's ArrowRight shortcut are tracked. Failed clicks, Stop, and unsolicited disconnects do not count.
- Live remote playback is recognized without the expected playback CSS class. Searching/stopped states and missing or ended media are excluded.
- The larger 420-pixel HUD has Sessions, Skipped, chat time, tracking controls, and Next. It fits smaller screens.
- Counters synchronize across tabs, persist through reloads, and reset only after confirmation.
- Browser bundles contain no video models or classification code.

Existing aggregate counters are preserved, including historical fields no longer displayed. New Sessions starts at zero because previous releases did not track connections. Legacy filtering modules and assets remain in source for reference but are not loaded or shipped in the browser runtime.

## Install

Use Node.js 22 or newer and npm:

```sh
git clone https://github.com/arnavsx3/wingman.git
cd wingman
npm ci
npm run build
```

For Brave, Chrome, Edge, or compatible Chromium browsers:

1. Open the extensions page, such as `brave://extensions`.
2. Enable Developer mode and choose **Load unpacked**.
3. Select `dist/chrome-mv3`.
4. Refresh OmeTV or MiniChat.

After an update, reload Wingman's extension card and refresh the site. Check that the settings panel shows version 1.2.0.

For Firefox, run `npm run build:firefox`. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox-mv3/manifest.json`. Allow access to supported sites when asked. Temporary installs end when Firefox restarts; regular distribution requires Mozilla signing. Both targets use Manifest V3.

[GitHub Actions](https://github.com/arnavsx3/wingman/actions/workflows/build.yml) provides development ZIPs. Extract the Chrome ZIP before loading its folder unpacked.

## Controls and Counters

Use the HUD or settings panel's **Next** for a manual skip. It is disabled without an active tracked connection. Pause tracking in either panel or using **Alt+W** outside chat fields. Wingman does not start chats or reconnect after Stop.

Counters represent observable page activity, not guaranteed server acknowledgment. Ignored Next clicks time out without adding a skip. A partner leaving at the same moment as a Next request cannot be distinguished from a successful skip. Unavailable controls produce an error rather than clicking arbitrary buttons.

Pause prevents new counts. Resuming an already-counted connection does not count it again; resuming one first seen while paused counts it once. Reset clears aggregate totals, not the active connection's clock or identity. The active connection is not immediately recounted after reset.

Connection sound depends on browser audio policy. Hiding the HUD does not stop tracking; re-enable it in the settings panel.

## Development

```sh
npm run dev
npm run dev:firefox
npm run check
npm run build
npm run build:firefox
npm run verify:bundles
npx playwright install chromium
npm run test:e2e
npm run zip
npm run zip:firefox
```

Builds are in `dist/`. Installed-extension tests use intercepted fixture pages and synthetic streams, not cameras or strangers. They cover connection counts, manual Next paths, failure, Stop, pause, persistence, cross-context storage, resets, native settings-window dimensions, and responsive HUD screenshots. Diagnostics are in `test-results/`.

## Architecture

| Module | Responsibility |
| --- | --- |
| `entrypoints/background.ts` | Serialized storage mutations and tracking badge |
| `entrypoints/content.ts` | Lifecycle, subscriptions, manual controls, and shortcuts |
| `modules/ometv/session.ts` | Remote stream/track and playback identity |
| `modules/ometv/assistant.ts` | Session counts and confirmed manual-skip accounting |
| `modules/ometv/skipper.ts` | Validated site controls and optional audio |
| `modules/ometv/hud.tsx` | Shadow-root controls and chat timer |
| `modules/preferences.ts` | Validation and migration |

## Limits

- Reload the site after installing or updating the extension.
- Waiting while connected means the expected remote element/stream is not observable. A different layout or a transition with no stream, track, or playback change may be indistinguishable.
- Next unavailable means the control is hidden, disabled, or changed. Wingman does not click Start as Next.
- Background pages may receive delayed browser events. Counters use observable transitions, not network interception.
- Real matchmaking, MiniChat layout compatibility, and Firefox runtime behavior still require manual verification.

## Privacy and License

Preferences and aggregate counters stay in extension-local storage. Wingman does not save media, keep per-person history, or send telemetry. See [PRIVACY.md](PRIVACY.md).

[MIT](LICENSE). Bundled notices cover third-party dependencies. Wingman is not affiliated with OmeTV or MiniChat; site rules still apply.
