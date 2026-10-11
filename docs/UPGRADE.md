# 1.1 Upgrade Plan and Verification

## Scope

Stabilize the existing local visual-detection approach, fix incorrect filter and counting behavior, make uncertainty explicit, and deliver usable cross-browser packages. Preserve existing stored preferences and aggregate statistics. Publishing to extension stores, introducing a server, and retraining the model are outside this release.

## Stage 1: Connection and State Reliability

Completed: introduce connection IDs; observe stream/track and playback transitions; discard stale results; serialize inference; cancel pending clicks; implement all filter modes; distinguish uncertain results; validate stored data; serialize background writes; remove unused traffic hooks; add focused regression tests.

Acceptance: no delayed action is allowed to proceed after its connection or decision generation changes; missing controls and failed inference do not count as successful matches or male skips; concurrent writes retain every completed mutation.

## Stage 2: Controls and Runtime Feedback

Completed: refresh the popup and shadow-root HUD; add confidence and uncertainty controls; report loading, analysis, pause, keep, skip, and failures; provide explicit retry; preserve keyboard text entry; isolate HUD styling; synchronize all views and the badge; validate with an installed Chrome extension.

Acceptance: toggles respond immediately, persisted state survives reopening, reset requires confirmation, and controls remain within compact and desktop viewports. A blank synthetic video runs through the real bundled models and is counted as unknown only when timed skipping is enabled.

## Stage 3: Packaging and Maintenance

Completed: version 1.1.0; explicit Firefox MV3 builds; manifest and model-size checks; expanded CI; deterministic dependency installation; third-party notices; updated installation/troubleshooting/privacy documentation; Chrome and Firefox ZIP packages.

Acceptance: application and test sources type-check; unit and Chromium integration suites pass; both bundles validate; ZIPs contain model weights, runtime assets, and notices; CI repeats these checks on pushes and pull requests.

## Remaining Manual Validation

Actual OmeTV matchmaking, real-user prediction accuracy, alternate MiniChat layouts, audible playback under browser gesture policies, and Firefox runtime behavior are not established by the automated tests. No actual stranger video is used by the automated suite. The retained model's score is not an accuracy measurement, and no release can promise perfect gender filtering or protection from platform enforcement.
