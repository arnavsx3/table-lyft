export const pickerStyles = `
:host { all: initial; position: fixed; inset: 0; width: 0; height: 0; z-index: 2147483647; color-scheme: light; }
* { box-sizing: border-box; letter-spacing: 0; }
.lyft-panel { position: fixed; right: 18px; top: 18px; width: min(364px, calc(100vw - 36px)); max-height: calc(100vh - 36px); display: flex; flex-direction: column; background: #fff; color: #202826; border: 1px solid #b6cabc; border-radius: 8px; box-shadow: 0 10px 38px #142e2929; font: 14px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
header { display: flex; align-items: center; gap: 9px; padding: 15px; border-bottom: 1px solid #e0e7e2; }
header > svg { color: #17614d; flex: 0 0 auto; } header strong { font-size: 17px; } header > span { font-size: 11px; color: #66736d; margin-left: auto; white-space: nowrap; }
button { font: inherit; cursor: pointer; } button:disabled { opacity: .5; cursor: wait; } button:focus-visible { outline: 2px solid #287dc2; outline-offset: -3px; }
header button { background: transparent; color: #637469; border: 0; width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border-radius: 4px; }
header button:hover { background: #edf3ef; }
.lyft-list { overflow: auto; overscroll-behavior: contain; padding: 7px; }
.lyft-list > button { display: flex; align-items: center; gap: 11px; width: 100%; border: 1px solid transparent; border-radius: 5px; padding: 12px 10px; text-align: left; background: #fff; color: #25392e; }
.lyft-list > button.active { background: #edf6f0; border-color: #c9e2d2; }
.lyft-number { font: 11px ui-monospace, monospace; color: #829288; flex: 0 0 auto; }
.lyft-table { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.lyft-table strong { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }.lyft-table small { color: #697b6e; font-size: 11px; }
.lyft-list > button > svg { flex: 0 0 auto; color: #63806c; }
.lyft-outline { position: fixed; pointer-events: none; border: 2px solid #2b9c73; background: #2b9c730c; border-radius: 3px; }
footer { border-top: 1px solid #e0e7e2; padding: 10px 15px; display: flex; justify-content: space-between; font-size: 10px; color: #7c8a81; }
.lyft-empty { padding: 34px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #66796b; }.lyft-empty strong { font-size: 14px; }
.lyft-error { padding: 12px 15px; display: flex; gap: 9px; background: #fff0e9; color: #873e25; font-size: 12px; overflow-wrap: anywhere; }.lyft-error > svg { flex: 0 0 auto; margin-top: 2px; }
.lyft-progress { padding: 11px 15px; display: flex; align-items: center; gap: 8px; color: #17614d; background: #edf6f0; font-size: 12px; }
`;
