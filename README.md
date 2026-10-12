# Wingman

[![Build and tests](https://github.com/arnavsx3/wingman/actions/workflows/build.yml/badge.svg)](https://github.com/arnavsx3/wingman/actions/workflows/build.yml)

Manual session controls for OmeTV and MiniChat, with an isolated in-page HUD and opt-in, read-only partner metadata diagnostics.

## Version 1.3.1

**The 1.3.0 numeric auto-skip prototype has been withdrawn after reported incorrect live skips.** The outgoing selector mapping does not establish the meaning of received partner data. There is no validated code-to-gender mapping. Swapping codes or relabeling past counts would not fix that.

Automatic skipping is unavailable in this release, even if a profile saved `experimentalAutoSkip: true`. The active content scripts no longer load the numeric controller, its snapshot client or its page bridge. The settings switch is disabled and normalization rejects attempts to re-enable it. There is no face/voice classification or automatic fallback.

- Girls connected and Male/couple skipped show `--`, meaning unavailable, not zero. Past prototype totals are preserved in storage but are not presented as gender counts.
- Manual Next remains available. It updates the preserved generic skip total only after an observed connection transition within three seconds. Failed clicks, Stop and unsolicited disconnects do not count.
- Partner data check now shows aggregate raw root `Gender` code totals: exact numeric `1`, exact numeric `2`, and other/missing. These do not identify gender, count unique people, or trigger actions.
- Live remote playback is recognized without the expected playback CSS class. Searching/stopped states and missing or ended media are excluded.
- The 420-pixel HUD has unavailable gender-total placeholders, chat time, tracking controls, Next and a visible mapping-withdrawal notice. It fits smaller screens; the settings panel is 520 pixels wide.
- Counters synchronize across tabs, persist through reloads, and reset only after confirmation.
- Browser bundles contain no video models or classification code.

Existing aggregate counters are preserved, not reset or relabeled. For example, a 1.3.0 "Male/couple skipped" total of 42 meant 42 transition-confirmed code-1 skip requests, not 42 verified men. A zero "Girls connected" total meant no established code-2 connection met the prototype's counting condition, not that no girls connected. Legacy filtering and withdrawn prototype modules remain in source for reference only and are not loaded or shipped in the browser runtime.

The opt-in **Partner data check** remains diagnostic only. Its retained fields and aggregate code totals never trigger actions or counter writes. See [Partner Data Check](docs/PARTNER_DATA_CHECK.md) for evidence and limits.

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

After an update, reload Wingman's extension card and refresh the site. Check that the settings panel shows version 1.3.1 and Experimental auto-skip is disabled.

For Firefox 128 or newer, run `npm run build:firefox`. Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox-mv3/manifest.json`. Allow access to supported sites when asked. Temporary installs end when Firefox restarts; regular distribution requires Mozilla signing. Both targets use Manifest V3. The diagnostic bridge requires page-world content script support (Chromium 111+, Firefox 128+).

[GitHub Actions](https://github.com/arnavsx3/wingman/actions/workflows/build.yml) provides development ZIPs. Extract the Chrome ZIP before loading its folder unpacked.

## Controls and Counters

Use the HUD or settings panel's **Next** for a manual skip. It is disabled without an active tracked connection. Pause tracking in either panel or using **Alt+W** outside chat fields. Wingman does not start chats or reconnect after Stop.

Counters represent observable page activity, not guaranteed server acknowledgment. Ignored Next clicks time out without adding a skip. A partner leaving at the same moment as a Next request cannot be distinguished from a successful skip. Unavailable controls produce an error rather than clicking arbitrary buttons.

Pause prevents new generic activity counts. Reset clears stored aggregate totals, including the preserved 1.3.0 prototype history, not the active connection's clock. No gender counters are generated. The independent diagnostic can run while Session tracking is paused.

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

Builds are in `dist/`. Installed-extension tests use intercepted fixture pages and synthetic streams, not cameras or strangers. They cover manual controls, old-enable-flag migration, rejection of re-enablement, absence of numeric auto-actions, preserved history, failure, Stop, pause, resets, native settings-window dimensions, responsive HUD screenshots and raw-code diagnostics. Source-only prototype unit tests do not imply it is shipped or that its mapping is valid. Test artifacts are in `test-results/`.

## Architecture

| Module | Responsibility |
| --- | --- |
| `entrypoints/background.ts` | Serialized storage mutations and tracking badge |
| `entrypoints/content.ts` | Lifecycle, subscriptions, manual controls, and shortcuts |
| `entrypoints/partner-check.content.ts` | Dormant OmeTV-only read-only diagnostic bridge |
| `modules/ometv/metadata-probe.ts` | Bounded, read-only partner-state subscription |
| `modules/ometv/diagnostic-report.ts` | Field allowlist, redaction, message validation, and export |
| `modules/ometv/session.ts` | Remote stream/track and playback identity |
| `modules/ometv/assistant.ts` | Manual controls and transition-confirmed generic accounting |
| `modules/ometv/skipper.ts` | Validated site controls and optional audio |
| `modules/ometv/hud.tsx` | Shadow-root controls and chat timer |
| `modules/preferences.ts` | Validation and migration |

## Limits

- Reload the site after installing or updating the extension.
- Waiting while connected means the expected remote element/stream is not observable. A different layout or a transition with no stream, track, or playback change may be indistinguishable.
- Next unavailable means the control is hidden, disabled, or changed. Wingman does not click Start as Next.
- Background pages may receive delayed browser events. Counters use observable transitions, not network interception.
- Real matchmaking, MiniChat layout compatibility, and Firefox runtime behavior still require manual verification.
- Diagnostics depend on the current React/Redux store. Unavailable inspection is not proof that gender fields never exist. Raw code totals count the first sample of each distinct partner object, not every state transition or every person.
- Page data and the bridge are untrusted and cannot authenticate a partner's claims. The received field's provenance and meaning remain unverified. A controlled, independently confirmed explicit selection would be needed to investigate any future mapping; appearance is not evidence of that selection.

## Privacy and License

Preferences and aggregate counters stay in extension-local storage. Wingman does not save media, keep per-person history, or send telemetry. See [PRIVACY.md](PRIVACY.md).

[MIT](LICENSE). Bundled notices cover third-party dependencies. Wingman is not affiliated with OmeTV or MiniChat; site rules still apply.
