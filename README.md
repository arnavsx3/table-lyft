# Wingman

[![Build and tests](https://github.com/arnavsx3/wingman/actions/workflows/build.yml/badge.svg)](https://github.com/arnavsx3/wingman/actions/workflows/build.yml)

Session controls for OmeTV and MiniChat, with an isolated in-page HUD and an opt-in experimental OmeTV metadata-only auto-skip prototype.

## Version 1.3.0

The prototype assumes the received `interlocutor.Gender` uses the same codes as OmeTV's outgoing local selector: **2 = female, 1 = male/couple**. The outgoing mapping was inspected in the official client, and a user-submitted live report contained the received field. **The server's received-field meaning/provenance has not been independently verified. This is not reliable gender identification or a verified self-reported-gender filter.**

Automatic mode is **off by default**, including after upgrading. Enable **Experimental auto-skip** in the settings panel and keep Session tracking on to test it. It supports the current OmeTV desktop layout only. It does not start chats, request camera/microphone access, inspect pixels or voice, or fall back to media classification.

- Girls connected counts established code-2 connections observed in experimental mode, once per tab-local pair sequence after at least 500 ms of stable metadata. It does not verify actual gender or count unique people.
- Male/couple skipped counts automatic code-1 Next requests followed by an observed connection transition within three seconds. Couples cannot be separated from males with these codes.
- Missing, string-valued, unexpected, conflicting, unbound, or unavailable metadata leaves the connection unchanged and adds no prototype count. Only the exact root `interlocutor.Gender` field is used, not diagnostic history or alternative fields.
- Manual Next remains available, but does not add to either prototype counter. Failed clicks, Stop, and unsolicited disconnects do not add a prototype skip.
- Before an automatic action, a fresh on-demand snapshot must still match the active media and established partner sequence. There is at least 500 ms of stable data and one second between automatic requests; failed requests are not repeatedly clicked.
- Live remote playback is recognized without the expected playback CSS class. Searching/stopped states and missing or ended media are excluded.
- The 420-pixel HUD has the two experimental counters, chat time, tracking controls, Next, and a visible unverified-mapping notice. It fits smaller screens; the settings panel is 520 pixels wide.
- Counters synchronize across tabs, persist through reloads, and reset only after confirmation.
- Browser bundles contain no video models or classification code.

Existing aggregate counters are preserved but are no longer displayed. The two new prototype counters start at zero; historical classifications and manual skips are never relabeled as prototype results. Legacy filtering modules and assets remain in source for reference but are not loaded or shipped in the browser runtime.

The separate opt-in **Partner data check** remains diagnostic only. Its retained fields never trigger automatic actions. See [Partner Data Check](docs/PARTNER_DATA_CHECK.md) for verification evidence and limits.

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

After an update, reload Wingman's extension card and refresh the site. Check that the settings panel shows version 1.3.0, then enable Experimental auto-skip explicitly.

For Firefox 128 or newer, run `npm run build:firefox`. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox-mv3/manifest.json`. Allow access to supported sites when asked. Temporary installs end when Firefox restarts; regular distribution requires Mozilla signing. Both targets use Manifest V3. The diagnostic bridge requires page-world content script support (Chromium 111+, Firefox 128+).

[GitHub Actions](https://github.com/arnavsx3/wingman/actions/workflows/build.yml) provides development ZIPs. Extract the Chrome ZIP before loading its folder unpacked.

## Controls and Counters

Use the HUD or settings panel's **Next** for a manual skip. It is disabled without an active tracked connection. Pause tracking in either panel or using **Alt+W** outside chat fields. Wingman does not start chats or reconnect after Stop.

Counters represent observable page activity, not guaranteed server acknowledgment. Ignored Next clicks time out without adding a skip. A partner leaving at the same moment as a Next request cannot be distinguished from a successful skip. Unavailable controls produce an error rather than clicking arbitrary buttons.

Pause prevents new counts and automatic actions. Turning off Experimental auto-skip cancels pending prototype work. Manual Next and Stop cancel the current pair's delayed automatic decision. Resuming an already-counted pair does not count it again; an established code-2 pair first observed while paused can count once on resume. Reset clears aggregate totals, not the active connection's clock or pair sequence. The active pair is not immediately recounted after reset.

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

Builds are in `dist/`. Installed-extension tests use intercepted fixture pages and synthetic streams, not cameras or strangers. They cover manual controls, metadata-only automatic actions, counters, unknown data, failure, Stop, pause, persistence, cross-context storage, resets, native settings-window dimensions, responsive HUD screenshots, and opt-in diagnostics. Synthetic tests do not verify the live server mapping. Test artifacts are in `test-results/`.

## Architecture

| Module | Responsibility |
| --- | --- |
| `entrypoints/background.ts` | Serialized storage mutations and tracking badge |
| `entrypoints/content.ts` | Lifecycle, subscriptions, manual controls, and shortcuts |
| `entrypoints/partner-check.content.ts` | OmeTV-only on-demand metadata and optional diagnostic bridge |
| `modules/ometv/prototype-data.ts` | Exact current-partner field, established-state/media checks and tab-local sequence |
| `modules/ometv/prototype-client.ts` | Bounded request/response snapshots, cancellation and timeout |
| `modules/ometv/prototype.ts` | Opt-in unverified-code decisions, stable delay, deduplication and cancellation |
| `modules/ometv/metadata-probe.ts` | Bounded, read-only partner-state subscription |
| `modules/ometv/diagnostic-report.ts` | Field allowlist, redaction, message validation, and export |
| `modules/ometv/session.ts` | Remote stream/track and playback identity |
| `modules/ometv/assistant.ts` | Manual controls and transition-confirmed manual/automatic accounting |
| `modules/ometv/skipper.ts` | Validated site controls and optional audio |
| `modules/ometv/hud.tsx` | Shadow-root controls and chat timer |
| `modules/preferences.ts` | Validation and migration |

## Limits

- Reload the site after installing or updating the extension.
- Waiting while connected means the expected remote element/stream is not observable. A different layout or a transition with no stream, track, or playback change may be indistinguishable.
- Next unavailable means the control is hidden, disabled, or changed. Wingman does not click Start as Next.
- Background pages may receive delayed browser events. Counters use observable transitions, not network interception.
- Real matchmaking, MiniChat layout compatibility, and Firefox runtime behavior still require manual verification.
- Diagnostics and the prototype depend on the current React/Redux store. A missing `PairId`, unsupported layout, non-established state, or unavailable bridge prevents prototype actions. A stream replacement without an established new pair is left unchanged.
- Page data and the bridge are untrusted and cannot authenticate a partner's claims. The numeric mapping/provenance is unverified; the prototype may keep or skip the wrong connections. Its counters are experimental code-based activity, not verified gender totals.

## Privacy and License

Preferences and aggregate counters stay in extension-local storage. Wingman does not save media, keep per-person history, or send telemetry. See [PRIVACY.md](PRIVACY.md).

[MIT](LICENSE). Bundled notices cover third-party dependencies. Wingman is not affiliated with OmeTV or MiniChat; site rules still apply.
