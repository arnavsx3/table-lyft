import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Activity, ArrowUpRight, Check, CircleAlert, Eye, Heart, LoaderCircle, RotateCcw, ShieldCheck, SlidersHorizontal, Users, Volume2, X } from 'lucide-react';
import { getSettings, saveSettings, toggleEnabled, getStats, resetStats, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import type { RuntimeStatus, TargetGender, WingmanSettings, WingmanStats } from '@/modules/types';

function Toggle({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <label className="switch"><input type="checkbox" role="switch" aria-label={label}
    checked={checked} disabled={disabled} onChange={onChange} /><span /></label>;
}

function Range({ label, value, min, max, step, format, disabled, onSave }: {
  label: string; value: number; min: number; max: number; step: number; format: (value: number) => string;
  disabled?: boolean; onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const submitted = useRef(value);
  useEffect(() => { setDraft(value); submitted.current = value; }, [value]);
  const commit = (next: number) => {
    if (submitted.current === next) return;
    submitted.current = next;
    onSave(next);
  };
  return <label className="range-setting"><span className="range-heading"><span>{label}</span><output>{format(draft)}</output></span>
    <input type="range" min={min} max={max} step={step} value={draft} disabled={disabled} aria-label={label}
      aria-valuetext={format(draft)} onChange={event => setDraft(Number(event.target.value))}
      onPointerUp={event => commit(Number(event.currentTarget.value))}
      onKeyUp={event => commit(Number(event.currentTarget.value))}
      onBlur={event => commit(Number(event.currentTarget.value))} />
  </label>;
}

const unsupported: RuntimeStatus = { state: 'waiting', message: 'Open OmeTV to connect' };
const retryStates = ['model_error', 'skip_unavailable', 'error', 'uncertain'];

export default function App() {
  const [settings, setSettings] = useState<WingmanSettings | null>(null);
  const [stats, setStats] = useState<WingmanStats | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>(unsupported);
  const [tabId, setTabId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let active = true;
    const unwatchSettings = onSettingsChanged(next => { if (active) setSettings(next); });
    const unwatchStats = onStatsChanged(next => { if (active) setStats(next); });
    Promise.all([getSettings(), getStats()]).then(([nextSettings, nextStats]) => {
      if (active) { setSettings(nextSettings); setStats(nextStats); }
    }).catch(() => { if (active) setError('Could not load saved settings. Reopen Wingman to try again.'); });
    const refresh = async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url || !/^https?:\/\/([^/]+\.)?(ome\.tv|minichat\.com)(\/|$)/i.test(tab.url)) {
          if (active) { setTabId(null); setStatus(unsupported); }
          return;
        }
        if (active) setTabId(tab.id);
        const next: RuntimeStatus = await browser.tabs.sendMessage(tab.id, { type: 'WINGMAN_STATUS' });
        if (active && next?.state && typeof next.message === 'string') setStatus(next);
      } catch { if (active) setStatus({ state: 'error', message: 'Refresh this page to connect Wingman' }); }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 1500);
    return () => { active = false; clearInterval(timer); unwatchSettings(); unwatchStats(); };
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save changes. Please try again.');
      try { setSettings(await getSettings()); } catch { /* Keep the existing error visible. */ }
    }
    finally { setBusy(false); }
  };
  const save = (patch: Partial<WingmanSettings>) => {
    setSettings(current => current ? { ...current, ...patch } : current);
    void run(async () => { setSettings(await saveSettings(patch)); });
  };
  const retry = () => { if (tabId !== null) void run(() => browser.tabs.sendMessage(tabId, { type: 'WINGMAN_RETRY' })); };

  if (!settings || !stats) return <main className="loading" aria-live="polite"><img src="/icon-48.png" width="40" height="40" alt="" />
    <h1>Wingman</h1>{error ? <p role="alert">{error}</p> : <LoaderCircle className="spin" size={20} aria-label="Loading" />}</main>;

  const active = settings.enabled && settings.targetGender !== 'all';
  const delay = Math.round((settings.skipDelayMinMs + settings.skipDelayMaxMs) / 2);
  return <main className="app">
    <header className="header"><div className="brand"><img src="/icon-48.png" width="32" height="32" alt="" /><h1>Wingman</h1>
      <span className="version">{browser.runtime.getManifest().version}</span></div>
      <span className={`activity ${active ? 'on' : ''}`}><span />{active ? 'On' : 'Paused'}</span></header>

    <section className="master"><div><h2>Auto-skip</h2><span className="muted">OmeTV / MiniChat</span></div>
      <Toggle label="Auto-skip" checked={settings.enabled} disabled={busy}
        onChange={() => {
          setSettings({ ...settings, enabled: !settings.enabled });
          void run(async () => setSettings(await toggleEnabled()));
        }} /></section>

    <div className={`live-status ${retryStates.includes(status.state) ? 'warning' : ''}`} role="status">
      {retryStates.includes(status.state) ? <CircleAlert size={15} /> : <Activity size={15} />}
      <span>{status.message}</span>{tabId !== null && retryStates.includes(status.state) &&
        <button className="icon-button" title="Retry detection" aria-label="Retry detection" disabled={busy} onClick={retry}><RotateCcw size={15} /></button>}
    </div>
    {error && <div className="error" role="alert"><span>{error}</span><button className="icon-button" title="Dismiss error" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}

    <section><h2 className="section-title"><Users size={14} />Match preference</h2>
      <div className="segmented" role="group" aria-label="Match preference">{([
        ['girls_only', 'Women', Heart], ['boys_only', 'Men', Users], ['all', 'Everyone', ShieldCheck],
      ] as const).map(([value, label, Icon]) => <button key={value} aria-pressed={settings.targetGender === value}
        disabled={busy} onClick={() => save({ targetGender: value as TargetGender })}><Icon size={15} />{label}</button>)}</div>
    </section>

    <section className="tuning"><h2 className="section-title"><SlidersHorizontal size={14} />Detection</h2>
      <Range label="Skip delay" value={delay} min={300} max={2000} step={50} format={value => `${value} ms`} disabled={busy}
        onSave={value => save({ skipDelayMinMs: value - 150, skipDelayMaxMs: value + 150 })} />
      <Range label="Confidence threshold" value={Math.round(settings.minimumConfidence * 100)} min={70} max={99} step={1}
        format={value => `${value}%`} disabled={busy} onSave={value => save({ minimumConfidence: value / 100 })} />
      <div className="option"><label htmlFor="uncertain"><span>Skip uncertain matches</span></label>
        <input id="uncertain" className="checkbox" type="checkbox" checked={settings.skipUnknown} disabled={busy}
          onChange={event => save({ skipUnknown: event.target.checked })} /></div>
      {settings.skipUnknown && <label className="option" htmlFor="timeout"><span>Wait before skipping</span><select id="timeout"
        value={settings.unknownTimeoutMs} disabled={busy} onChange={event => save({ unknownTimeoutMs: Number(event.target.value) })}>
        {Array.from(new Set([3000, 5000, 8000, 12000, 20000, 30000, settings.unknownTimeoutMs])).sort((a, b) => a - b)
          .map(value => <option key={value} value={value}>{value / 1000} seconds</option>)}</select></label>}
    </section>

    <section><div className="section-heading"><h2 className="section-title"><Activity size={14} />Activity</h2>
      <div className="reset">{confirmReset ? <><button className="text-button danger" disabled={busy} onClick={() => {
        void run(async () => { setStats(await resetStats()); setConfirmReset(false); });
      }}>Reset all</button><button className="icon-button" aria-label="Cancel reset" title="Cancel reset" onClick={() => setConfirmReset(false)}><X size={14} /></button></> :
        <button className="icon-button" aria-label="Reset statistics" title="Reset statistics" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /></button>}</div>
      </div><div className="stats"><div><strong className="rose">{stats.totalSkipped.toLocaleString()}</strong><span>Skipped</span></div>
        <div><strong className="green">{stats.totalKept.toLocaleString()}</strong><span>Kept</span></div>
        <div><strong>{stats.unknownSkipped.toLocaleString()}</strong><span>Uncertain skips</span></div></div>
    </section>

    <section className="preferences"><div className="option"><span><Eye size={15} />In-page controls</span>
      <Toggle label="In-page controls" checked={settings.showInPageHud} disabled={busy} onChange={() => save({ showInPageHud: !settings.showInPageHud })} /></div>
      <div className="option"><span><Volume2 size={15} />Match sound</span><Toggle label="Match sound" checked={settings.soundAlertOnMatch}
        disabled={busy} onChange={() => save({ soundAlertOnMatch: !settings.soundAlertOnMatch })} /></div></section>

    <footer><span><Check size={13} />On-device only</span><a href="https://github.com/arnavsx3/wingman" target="_blank" rel="noreferrer" title="Wingman on GitHub">GitHub<ArrowUpRight size={13} /></a></footer>
    <p className="estimate-note">Appearance estimates can be wrong. Uncertain matches {settings.skipUnknown ? 'are skipped after the wait' : 'stay connected'}.</p>
  </main>;
}
