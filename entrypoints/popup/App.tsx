import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Activity, ArrowUpRight, Check, CircleAlert, Eye, LoaderCircle, RotateCcw, SkipForward, Volume2, X } from 'lucide-react';
import { getSettings, saveSettings, toggleEnabled, getStats, resetStats, onSettingsChanged, onStatsChanged } from '@/modules/storage';
import type { RuntimeStatus, WingmanSettings, WingmanStats } from '@/modules/types';

function Toggle({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <label className="switch"><input type="checkbox" role="switch" aria-label={label}
    checked={checked} disabled={disabled} onChange={onChange} /><span /></label>;
}

const unsupported: RuntimeStatus = { state: 'waiting', message: 'Open OmeTV to connect' };

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
    let settingsRevision = 0;
    let statsRevision = 0;
    const unwatchSettings = onSettingsChanged(next => { settingsRevision++; if (active) setSettings(next); });
    const unwatchStats = onStatsChanged(next => { statsRevision++; if (active) setStats(next); });
    Promise.all([getSettings(), getStats()]).then(([nextSettings, nextStats]) => {
      if (!active) return;
      if (settingsRevision === 0) setSettings(nextSettings);
      if (statsRevision === 0) setStats(nextStats);
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
    const timer = setInterval(() => { void refresh(); }, 1000);
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
  const send = (type: 'WINGMAN_RETRY' | 'WINGMAN_NEXT') => {
    if (tabId !== null) void run(() => browser.tabs.sendMessage(tabId, { type }));
  };

  if (!settings || !stats) return <main className="loading" aria-live="polite"><img src="/icon-48.png" width="40" height="40" alt="" />
    <h1>Wingman</h1>{error ? <p role="alert">{error}</p> : <LoaderCircle className="spin" size={20} aria-label="Loading" />}</main>;

  return <main className="app">
    <header className="header"><div className="brand"><img src="/icon-48.png" width="32" height="32" alt="" /><h1>Wingman</h1>
      <span className="version">{browser.runtime.getManifest().version}</span></div>
      <span className={`activity ${settings.enabled ? 'on' : ''}`}><span />{settings.enabled ? 'On' : 'Paused'}</span></header>
    <section className="master"><div><h2>Session tracking</h2><span className="muted">OmeTV / MiniChat</span></div>
      <Toggle label="Session tracking" checked={settings.enabled} disabled={busy}
        onChange={() => {
          setSettings({ ...settings, enabled: !settings.enabled });
          void run(async () => setSettings(await toggleEnabled()));
        }} /></section>
    <div className={`live-status ${status.state === 'error' ? 'warning' : ''}`} role="status">
      {status.state === 'error' ? <CircleAlert size={15} /> : <Activity size={15} />}
      <span>{status.message}</span>{tabId !== null && status.state === 'error' &&
        <button className="icon-button" title="Refresh status" aria-label="Refresh status" disabled={busy} onClick={() => send('WINGMAN_RETRY')}><RotateCcw size={15} /></button>}
    </div>
    {error && <div className="error" role="alert"><span>{error}</span><button className="icon-button" title="Dismiss error" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
    <section><div className="section-heading"><h2 className="section-title"><Activity size={14} />Activity</h2>
      <div className="reset">{confirmReset ? <><button className="text-button danger" disabled={busy} onClick={() => {
        void run(async () => { setStats(await resetStats()); setConfirmReset(false); });
      }}>Reset all</button><button className="icon-button" aria-label="Cancel reset" title="Cancel reset" onClick={() => setConfirmReset(false)}><X size={14} /></button></> :
        <button className="icon-button" aria-label="Reset statistics" title="Reset statistics" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /></button>}</div>
      </div><div className="stats"><div><strong className="green" aria-label="Sessions">{stats.totalSessions.toLocaleString()}</strong><span>Sessions</span></div>
        <div><strong className="rose" aria-label="Skipped">{stats.totalSkipped.toLocaleString()}</strong><span>Skipped</span></div></div>
    </section>
    <section className="preferences"><div className="option"><span><Eye size={15} />In-page controls</span>
      <Toggle label="In-page controls" checked={settings.showInPageHud} disabled={busy} onChange={() => save({ showInPageHud: !settings.showInPageHud })} /></div>
      <div className="option"><span><Volume2 size={15} />Connection sound</span><Toggle label="Connection sound" checked={settings.soundAlertOnMatch}
        disabled={busy} onChange={() => save({ soundAlertOnMatch: !settings.soundAlertOnMatch })} /></div></section>
    <button className="next-button" aria-label="Next connection" disabled={busy || !settings.enabled || !status.canSkip || tabId === null}
      onClick={() => send('WINGMAN_NEXT')}><SkipForward size={17} />Next</button>
    <footer><span><Check size={13} />Manual controls</span><a href="https://github.com/arnavsx3/wingman" target="_blank" rel="noreferrer" title="Wingman on GitHub">GitHub<ArrowUpRight size={13} /></a></footer>
  </main>;
}
