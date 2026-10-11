import { createRoot, type Root } from 'react-dom/client';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import type { RuntimeStatus, WingmanSettings, WingmanStats } from '../types';

const css = `
  :host { all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: min(350px, calc(100vw - 32px)); color-scheme: dark; }
  * { box-sizing: border-box; letter-spacing: 0; }
  .hud { font: 12px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #202126; color: #f3f3f5; border: 1px solid #44454e; border-radius: 8px; box-shadow: 0 4px 18px #0004; padding: 10px 12px; }
  .top, .brand, .actions, .metrics { display: flex; align-items: center; gap: 8px; }
  .top { justify-content: space-between; }
  .brand { font-weight: 700; font-size: 13px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #82d6bc; }
  .dot.off { background: #a2a4ae; }
  button { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 4px; border: 0; border-radius: 4px; background: transparent; color: #c3c5cf; cursor: pointer; }
  button:hover { background: #3c3d45; color: white; }
  button:focus-visible { outline: 2px solid #82d6bc; outline-offset: 1px; }
  .status { color: #82d6bc; margin: 5px 0 7px; font-size: 11px; overflow-wrap: anywhere; }
  .status.warning { color: #f1c880; }
  .metrics { color: #a2a4ae; font-size: 10px; flex-wrap: wrap; }
  .metrics strong { color: #f3f3f5; font-variant-numeric: tabular-nums; font-weight: 600; }
  .mode { margin-left: auto; color: #ff92ae; }
`;

export class WingmanInPageHud {
  private host: HTMLDivElement | null = null;
  private root: Root | null = null;
  private settings: WingmanSettings | null = null;
  private stats: WingmanStats | null = null;
  private status: RuntimeStatus = { state: 'waiting', message: 'Waiting for next connection' };
  private onToggle: () => void = () => {};
  private onRetry: () => void = () => {};
  private onHide: () => void = () => {};

  public init(onToggle: () => void, onRetry: () => void, onHide: () => void) {
    this.onToggle = onToggle; this.onRetry = onRetry; this.onHide = onHide;
    this.host = document.createElement('div');
    this.host.id = 'wingman-hud-root';
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    const mount = document.createElement('div');
    shadow.append(style, mount);
    document.body.append(this.host);
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
    const warning = ['error', 'model_error', 'skip_unavailable', 'uncertain'].includes(this.status.state);
    this.root?.render(<aside className="hud" aria-label="Wingman"><div className="top"><div className="brand">
      <span className={`dot ${settings.enabled && settings.targetGender !== 'all' ? '' : 'off'}`} />Wingman</div><div className="actions">
      {warning && <button title="Retry detection" aria-label="Retry detection" onClick={this.onRetry}><RotateCcw size={14} /></button>}
      <button title={settings.enabled ? 'Pause filtering' : 'Resume filtering'} aria-label={settings.enabled ? 'Pause filtering' : 'Resume filtering'}
        onClick={this.onToggle}>{settings.enabled ? <Pause size={14} /> : <Play size={14} />}</button>
      <button title="Hide controls" aria-label="Hide controls" onClick={this.onHide}><X size={14} /></button></div></div>
      <p className={`status ${warning ? 'warning' : ''}`} role="status">{this.status.message}</p>
      <div className="metrics"><span>Skipped <strong>{stats.totalSkipped.toLocaleString()}</strong></span><span>Kept <strong>{stats.totalKept.toLocaleString()}</strong></span>
        <span className="mode">{settings.targetGender === 'girls_only' ? 'Women' : settings.targetGender === 'boys_only' ? 'Men' : 'Everyone'}</span></div></aside>);
  }

  public destroy() { this.root?.unmount(); this.host?.remove(); this.root = null; this.host = null; }
}
