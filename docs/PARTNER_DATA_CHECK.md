# Partner Data Check

Version 1.2.1 is a diagnostic release, not an automatic gender-filtering release.

## Run It in Brave

1. Reload Wingman in `brave://extensions`, then refresh OmeTV. Confirm version **1.2.1** in Wingman's settings panel.
2. In **Partner data check**, click the scan icon labeled **Start partner data check**. This works independently of the Session tracking switch.
3. Use OmeTV normally. Wingman does not click Start, obtain camera/microphone permission, or establish a chat for you.
4. Allow several normal connections to be checked. An already-active connection may be sampled immediately. The check ends after 20 samples or five minutes; the square icon stops it sooner.
5. Click the download icon to save `wingman-partner-check.json`. Share that reduced report when debugging, not screenshots of strangers, chat content, or full network captures.

Reports reset on page reload. No diagnostic results are saved to extension storage. Normal session and manual-skip counting are unchanged; this diagnostic has no action or counter-writing path.

## Read the Result

| Result | Meaning |
| --- | --- |
| Not checked | The check has not started, or stopped without any samples. |
| Looking for partner data | Waiting for the supported page store to appear. |
| Check ready. Waiting for a connection. | The observer attached; no active partner was sampled yet. |
| No gender field seen in checked connections | Partner objects were read, but none of the allowlisted fields appeared. This is not proof that every protocol/layout lacks the data. |
| Candidate gender field observed; meaning unverified | At least one allowlisted field appeared. Its provenance, meaning, and connection binding still need verification before filtering. |
| Partner data could not be inspected | The expected store was not found or could not be read. This says nothing about whether the server sends gender. |
| Check unavailable. Reload OmeTV and try again. | The page bridge did not respond. Refresh the site after reloading/updating the extension. |

The displayed field list comes from the last sample containing candidate fields, not necessarily the current partner. Samples are deduplicated by object identity in tab memory, not by user ID; reconnects or replaced objects can produce another sample. These are diagnostic sample totals, not new activity counters.

## Scope and Limits

The public desktop client inspected on October 12, 2026 stores a connection payload in `rouletteState.interlocutor` when its `BGD` message is handled. It separately stores the user's own selector in `ownGender`. This identifies a partner-specific place to inspect; it does **not** establish that gender is present there. Reference: [OmeTV chat client](https://cdn.ome.tv/scripts/main.js).

The diagnostic checks only `Gender`, `gender`, `Sex`, and `sex` at the partner-object root and inside `DialogData`. It does not infer attributes from media, guess missing field names, scan arbitrary nested profiles, or decode private traffic. The observer depends on the current React/Redux layout and may become unavailable after site changes. MiniChat and the mobile client's different layouts are not supported by this check.

Recognized text labels, small numeric codes, and booleans can be included in a report; other values are withheld. Numeric codes are deliberately not translated. The inspected local-selector code uses value `1` for both male and couple selections, demonstrating why assuming `1 = male partner` would be unsafe. Even a text field must be verified as explicit partner-provided metadata rather than a server-inferred label or unrelated setting.

The report and bridge are controlled by the page environment and cannot authenticate the partner's claims. No diagnostic message can initiate skipping, change statistics, or write preferences. There is no claim that the collected sample confirms a person's actual gender.

## Validation

Unit tests cover allowlisting/redaction, malformed messages, excluded local gender, subscription cleanup, replaced/late stores, unavailable observers, object deduplication, and limits. Installed Chromium tests cover the complete MAIN-to-ISOLATED bridge, both panels, a sanitized report download, absence of diagnostic storage, unchanged counters, no skip clicks, and narrow/desktop layout screenshots.

Fixture metadata is synthetic and does not prove OmeTV exposes partner gender in live matchmaking. The real connection report remains the evidence needed for the next step.

A public-page Chromium smoke test on October 12, 2026 attached successfully to the current OmeTV store and reported that it was waiting for a connection. WebSockets and camera/microphone access were blocked during that check; zero partners were sampled. This validates observer attachment only, not partner-gender availability. Firefox runtime behavior remains unverified.
