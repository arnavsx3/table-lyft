import { WingmanSettings, WingmanStats } from '../types';

export class WingmanInPageHud {
  private container: HTMLDivElement | null = null;
  private onToggleCallback: (() => void) | null = null;

  public init(onToggle: () => void) {
    this.onToggleCallback = onToggle;
    this.createDom();
  }

  private createDom() {
    if (this.container || document.getElementById('wingman-hud-root')) return;

    this.container = document.createElement('div');
    this.container.id = 'wingman-hud-root';
    this.container.innerHTML = `
      <div id="wingman-hud" style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        border-radius: 14px;
        padding: 10px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #f8fafc;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 12px;
        user-select: none;
        transition: all 0.2s ease;
      ">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span id="wm-status-dot" style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
          "></span>
          <strong style="font-weight: 700; letter-spacing: -0.2px;">Wingman</strong>
        </div>

        <div style="height: 16px; width: 1px; background: rgba(255,255,255,0.15);"></div>

        <div style="display: flex; gap: 10px; font-size: 12px;">
          <span>Skipped: <strong id="wm-skipped" style="color: #f87171;">0</strong></span>
          <span>Girls: <strong id="wm-matched" style="color: #34d399;">0</strong></span>
        </div>

        <button id="wm-toggle-btn" style="
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          transition: background 0.15s;
        ">Pause</button>
      </div>
    `;

    document.body.appendChild(this.container);

    const toggleBtn = document.getElementById('wm-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onToggleCallback?.();
      });
      toggleBtn.addEventListener('mouseenter', () => {
        toggleBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      });
      toggleBtn.addEventListener('mouseleave', () => {
        toggleBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      });
    }
  }

  public update(settings: WingmanSettings, stats: WingmanStats) {
    if (!settings.showInPageHud) {
      if (this.container) {
        this.container.style.display = 'none';
      }
      return;
    }

    if (this.container) {
      this.container.style.display = 'block';
    }

    const dot = document.getElementById('wm-status-dot');
    const toggleBtn = document.getElementById('wm-toggle-btn');
    const skipped = document.getElementById('wm-skipped');
    const matched = document.getElementById('wm-matched');

    if (dot) {
      dot.style.background = settings.enabled ? '#10b981' : '#64748b';
      dot.style.boxShadow = settings.enabled ? '0 0 8px #10b981' : 'none';
    }

    if (toggleBtn) {
      toggleBtn.textContent = settings.enabled ? 'Pause' : 'Resume';
      toggleBtn.style.borderColor = settings.enabled ? 'rgba(255, 255, 255, 0.15)' : '#10b981';
    }

    if (skipped) {
      skipped.textContent = String(stats.totalSkipped);
    }

    if (matched) {
      matched.textContent = String(stats.femalesMatched);
    }
  }

  public destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
