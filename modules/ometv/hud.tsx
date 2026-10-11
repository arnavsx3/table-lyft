import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';
import type { RuntimeStatus, WingmanSettings, WingmanStats } from '../types';

const css = `
  :host { all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: min(420px, calc(100vw - 32px)); color-scheme: dark; }
  * { box-sizing: border-box; letter-spacing: 0; }
  .hud { font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #202126; color: #f3f3f5; border: 1px solid #44454e; border-radius: 8px; box-shadow: 0 4px 18px #0004; padding: 16px; }
  .top, .brand, .actions { display: flex; align-items: center; gap: 8px; }
  .top { justify-content: space-between; }
  .brand { font-weight: 700; font-size: 16px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #82d6bc; }
  .dot.off { background: #a2a4ae; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 32px; height: 32px; padding: 6px; border: 0; border-radius: 4px; background: transparent; color: #c3c5cf; cursor: pointer; font: inherit; flex: 0 0 auto; }
  button:hover { background: #3c3d45; color: white; }
  button:disabled { opacity: .45; cursor: default; }
  button:focus-visible { outline: 2px solid #82d6bc; outline-offset: 2px; }
  .status { color: #82d6bc; margin: 10px 0 14px; font-size: 13px; min-height: 19px; overflow-wrap: anywhere; }
  .status.warning { color: #f1c880; }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; border-top: 1px solid #44454e; padding-top: 12px; }
  .metric { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
  .metric strong, .metric time { color: #f3f3f5; font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; display: block; height: 35px; white-space: nowrap; }
  .metric span { color: #b7b9c3; font-size: 11px; }
  .metric.skips strong { color: #ff92ae; }
  .next { width: 100%; height: 40px; margin-top: 16px; color: white; background: #168769; font-weight: 600; }
  .next:hover:not(:disabled) { background: #1a9b79; }
`;

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatCount(value: number) {
  return value < 10000 ? value.toLocaleString('en-US') : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function ChatClock({ startedAt }: { startedAt?: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (startedAt === undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  const text = startedAt === undefined ? '--:--' : formatDuration(now - startedAt);
  return <time aria-label="Chat duration" style={{ fontSize: text.length > 7 ? 12 : text.length > 5 ? 18 : undefined }}>{text}</time>;
}

export class WingmanInPageHud {
  private host: HTMLDivElement | null = null;
  private root: Root | null = null;
  private settings: WingmanSettings | null = null;
  private stats: WingmanStats | null = null;
  private status: RuntimeStatus = { state: 'waiting', message: 'Waiting for next connection' };
  private onToggle = () => {};
  private onNext = () => {};
  private onRetry = () => {};
  private onHide = () => {};

  public init(onToggle: () => void, onNext: () => void, onRetry: () => void, onHide: () => void) {
    this.onToggle = onToggle; this.onNext = onNext; this.onRetry = onRetry; this.onHide = onHide;
    this.host = document.createElement('div');
    this.host.id = 'wingman-hud-root';
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = css;
    const mount = document.createElement('div'); shadow.append(style, mount); document.body.append(this.host);
    this.root = createRoot(mount);
  }

  public update(settings: WingmanSettings, stats: WingmanStats) {
    this.settings = settings; this.stats = stats;
    if (this.host) this.host.style.display = settings.showInPageHud ? 'block' : 'none';
    this.render();
  }

  public setStatus(status: RuntimeStatus) { this.status = status; this.render(); }

  private render() {
    const settings = this.settings;
    const stats = this.stats;
    if (!settings || !stats) return;
    const warning = this.status.state === 'error';
    this.root?.render(<aside className="hud" aria-label="Wingman"><div className="top"><div className="brand">
      <span className={`dot ${settings.enabled ? '' : 'off'}`} />Wingman</div><div className="actions">
      {warning && <button title="Refresh status" aria-label="Refresh status" onClick={this.onRetry}><RotateCcw size={17} /></button>}
      <button title={settings.enabled ? 'Pause tracking' : 'Resume tracking'} aria-label={settings.enabled ? 'Pause tracking' : 'Resume tracking'}
        onClick={this.onToggle}>{settings.enabled ? <Pause size={17} /> : <Play size={17} />}</button>
      <button title="Hide controls" aria-label="Hide controls" onClick={this.onHide}><X size={17} /></button></div></div>
      <p className={`status ${warning ? 'warning' : ''}`} role="status">{this.status.message}</p>
      <div className="metrics"><div className="metric" aria-label="Sessions"><strong title={stats.totalSessions.toLocaleString()}>{formatCount(stats.totalSessions)}</strong><span>Sessions</span></div>
        <div className="metric skips" aria-label="Skipped"><strong title={stats.totalSkipped.toLocaleString()}>{formatCount(stats.totalSkipped)}</strong><span>Skipped</span></div>
        <div className="metric"><ChatClock startedAt={this.status.connectedAt} /><span>Chat time</span></div></div>
      <button className="next" title="Next connection" aria-label="Next connection" disabled={!settings.enabled || !this.status.canSkip} onClick={this.onNext}>
        <SkipForward size={18} />Next</button></aside>);
  }

  public destroy() { this.root?.unmount(); this.host?.remove(); this.root = null; this.host = null; }
}
