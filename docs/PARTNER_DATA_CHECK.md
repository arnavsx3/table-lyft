# Partner Data Check

Version 1.2.1 introduced this diagnostic. Version 1.3.1 withdraws the 1.3.0 numeric auto-skip prototype and adds raw-code aggregate counts. Diagnostic reports never trigger actions or gender-counter writes.

## Run It in Brave

1. Reload Wingman in `brave://extensions`, then refresh OmeTV. Confirm version **1.3.1** in Wingman's settings panel; Experimental auto-skip is disabled.
2. In **Partner data check**, click the scan icon labeled **Start partner data check**. This works independently of the Session tracking switch.
3. Use OmeTV normally. Wingman does not click Start, obtain camera/microphone permission, or establish a chat for you.
4. Allow several normal connections to be checked. An already-active connection may be sampled immediately. The check ends after 20 samples or five minutes; the square icon stops it sooner.
5. Click the download icon to save `wingman-partner-check.json`. Share that reduced report when debugging, not screenshots of strangers, chat content, or full network captures.

Reports reset on page reload. No diagnostic results are saved to extension storage. This diagnostic has no action or counter-writing path. Automatic gender filtering is unavailable in 1.3.1.

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

`rootCodeTotals` aggregates the exact root `interlocutor.Gender` value at the first sample of each checked object: numeric `1`, numeric `2`, or other/missing. Strings such as `"2"`, nested `DialogData.Gender`, other numeric values and absent fields go in the last bucket. The three counts sum to `checked`. These totals reveal whether sampled codes vary, but cannot establish their meaning, gender, provenance, unique people, or how the field changes later in a connection. No per-person sequence is retained.

## Scope and Limits

The public desktop client inspected on October 12, 2026 stores a connection payload in `rouletteState.interlocutor` when its `BGD` message is handled. It separately stores the user's own selector in `ownGender`. Source inspection identifies a partner-specific place to inspect; the submitted live report described below confirms a candidate field was present in that environment. Reference: [OmeTV chat client](https://cdn.ome.tv/scripts/main.js).

The diagnostic checks only `Gender`, `gender`, `Sex`, and `sex` at the partner-object root and inside `DialogData`. It does not infer attributes from media, guess missing field names, scan arbitrary nested profiles, or decode private traffic. The observer depends on the current React/Redux layout and may become unavailable after site changes. MiniChat and the mobile client's different layouts are not supported by this check.

Recognized text labels, small numeric codes, and booleans can be included in a report; other values are withheld. Numeric codes are deliberately not translated. The inspected local-selector code uses value `1` for both male and couple selections, demonstrating why assuming `1 = male partner` would be unsafe. Even a text field must be verified as explicit partner-provided metadata rather than a server-inferred label or unrelated setting.

The report and bridge are controlled by the page environment and cannot authenticate the partner's claims. No diagnostic message can initiate skipping, change statistics, or write preferences. There is no claim that the collected sample confirms a person's actual gender.

## October 12 Verification

The submitted 1.2.1 report recorded four checked partner objects, all four containing at least one candidate field. Its retained field list was `interlocutor.Gender`, numeric value `1`. This is the last candidate-bearing sample, not evidence that all four objects had value `1`, and not four necessarily distinct people. No identities or per-person history were collected.

The official desktop bundle fetched again for this verification had SHA-256 `44cc51bffd9850a2e0c3e596fb9652e517ec20ee05eebfb8175c4cb3aa65c5c2`. Its selector and outgoing lobby message establish:

| Explicit local selection | Outgoing lobby `Gender` |
| --- | --- |
| Male | `1` |
| Female | `2` |
| Couple | `1` |

These are protocol values, not the saved selector indexes. The local storage indexes are `0`, `1`, and `2` respectively. A separate outgoing `ExtraUserData.Gender` can be forced to the male selector value when `ticket.isPayer` or `ticket.isSuspected` is set. Neither outgoing field proves which value the server places in the received partner payload, or whether it transforms that value.

No explicit mapping from received `interlocutor.Gender` to a partner's selected setting was established by this source inspection. Version 1.3.0 offered an opt-in prototype based on the outgoing-code assumption; 1.3.1 withdraws it. In particular, `1` cannot be presented as verified male-only metadata: even the outgoing selector shares that code with couples.

### Live Failure Report

The user reported broad skipping, including connections they described as girls, while the code-2 connected counter stayed zero. They reported a displayed code-1 skip total of 42. This is evidence that the prototype was not meeting its intended behavior, not a validated mapping of those individuals' settings. No per-connection raw data or independently confirmed selected setting for those connections was supplied. Appearance and the aggregate count cannot establish that mapping.

In 1.3.0, the connected counter required stable code `2` in an established, bound connection. Zero means that condition was not observed, not that zero girls connected. The skipped total counted transition-confirmed automatic code-1 requests, not verified men. Version 1.3.1 preserves those old totals but hides the gender interpretation and removes the numeric action path. The raw-code report is for further inspection only; it cannot by itself justify restoring automatic filtering.

### Remaining Controlled Check

1. Use only a consenting test partner who can independently confirm the setting they selected. Appearance and voice are not evidence of that selection. Wingman cannot arrange a specific pairing; do not assume a random connection is the test partner.
2. For each confirmed test connection, start a fresh diagnostic run and download its report immediately after that sample, before another connection. An active connection may be sampled immediately. Keep each run to one checked object where possible so the retained field list is unambiguous.
3. Repeat with explicit Female, Male, and Couple selections where available. Record only the agreed selection and reduced candidate field/value, without names, chat, media, or identifiers.
4. Treat matching `2`, `1`, and `1` results as limited evidence for those tested conditions, not proof of universal server behavior. A mismatch, missing field, or inability to confirm the test pairing leaves the mapping unverified. Missing or ambiguous data must never be counted as a verified girl or boy.

Even after a successful controlled check, a code shared by Male and Couple requires an honest combined label, not a male-only counter. Such metadata reflects a reported selection, not an independently verified personal attribute.

## Validation

Unit tests cover allowlisting/redaction, malformed messages, excluded local gender, subscription cleanup, replaced/late stores, unavailable observers, object deduplication, and limits. Installed Chromium tests cover the complete MAIN-to-ISOLATED bridge, both panels, a sanitized report download, absence of diagnostic storage, unchanged counters, no skip clicks, and narrow/desktop layout screenshots.

Fixture metadata is synthetic and does not prove OmeTV exposes partner gender in live matchmaking. The submitted live report establishes candidate-field presence only; the controlled check above is still needed to investigate its meaning.

A public-page Chromium smoke test on October 12, 2026 attached successfully to the current OmeTV store and reported that it was waiting for a connection. WebSockets and camera/microphone access were blocked during that check; zero partners were sampled. This validates observer attachment only, not partner-gender availability. Firefox runtime behavior remains unverified.
