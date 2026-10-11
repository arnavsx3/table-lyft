import React, { useEffect, useState } from 'react';
import {
  Flame,
  Shield,
  Volume2,
  Layout,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Users,
  Heart
} from 'lucide-react';
import {
  getSettings,
  saveSettings,
  getStats,
  resetStats,
  onSettingsChanged,
  onStatsChanged
} from '@/modules/storage';
import type { TargetGender, WingmanSettings, WingmanStats } from '@/modules/types';

export default function App() {
  const [settings, setSettings] = useState<WingmanSettings | null>(null);
  const [stats, setStats] = useState<WingmanStats | null>(null);

  useEffect(() => {
    // Load initial data
    getSettings().then(setSettings);
    getStats().then(setStats);

    // Subscribe to updates
    onSettingsChanged(setSettings);
    onStatsChanged(setStats);
  }, []);

  if (!settings || !stats) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
        <span>Loading Wingman...</span>
      </div>
    );
  }

  const handleToggleEnabled = async () => {
    const updated = await saveSettings({ enabled: !settings.enabled });
    setSettings(updated);
  };

  const handleTargetGenderChange = async (target: TargetGender) => {
    const updated = await saveSettings({ targetGender: target });
    setSettings(updated);
  };

  const handleDelayChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const updated = await saveSettings({
      skipDelayMinMs: Math.max(150, val - 150),
      skipDelayMaxMs: val + 150,
    });
    setSettings(updated);
  };

  const handleToggleHud = async () => {
    const updated = await saveSettings({ showInPageHud: !settings.showInPageHud });
    setSettings(updated);
  };

  const handleToggleSound = async () => {
    const updated = await saveSettings({ soundAlertOnMatch: !settings.soundAlertOnMatch });
    setSettings(updated);
  };

  const handleResetStats = async () => {
    if (confirm('Reset matchmaking statistics for this session?')) {
      const fresh = await resetStats();
      setStats(fresh);
    }
  };

  const midDelay = Math.round((settings.skipDelayMinMs + settings.skipDelayMaxMs) / 2);

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="brand-icon">
            <Flame size={18} color="#fff" />
          </div>
          <span className="brand-title">Wingman</span>
          <span className="badge">v1.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: settings.enabled ? '#10b981' : '#64748b',
              boxShadow: settings.enabled ? '0 0 8px #10b981' : 'none'
            }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {settings.enabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Master Toggle */}
      <div className="master-card">
        <div className="master-info">
          <span className="master-label">Auto-Skip Matchmaker</span>
          <span className="master-desc">
            {settings.enabled
              ? 'Automatically filtering connections'
              : 'Filtering temporarily suspended'}
          </span>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={handleToggleEnabled}
          />
          <span className="slider"></span>
        </label>
      </div>

      {/* Matchmaking Filter Mode */}
      <div className="card">
        <div className="card-title">
          <Users size={12} />
          Target Filter
        </div>
        <div className="mode-group">
          <button
            className={`mode-btn ${settings.targetGender === 'girls_only' ? 'active' : ''}`}
            onClick={() => handleTargetGenderChange('girls_only')}
          >
            <Heart size={14} color={settings.targetGender === 'girls_only' ? '#ec4899' : '#94a3b8'} />
            Girls Only
          </button>
          <button
            className={`mode-btn ${settings.targetGender === 'boys_only' ? 'active' : ''}`}
            onClick={() => handleTargetGenderChange('boys_only')}
          >
            <Users size={14} />
            Boys Only
          </button>
          <button
            className={`mode-btn ${settings.targetGender === 'all' ? 'active' : ''}`}
            onClick={() => handleTargetGenderChange('all')}
          >
            <Shield size={14} />
            All (Off)
          </button>
        </div>
      </div>

      {/* Anti-Ban Skip Speed */}
      <div className="card">
        <div className="card-title">
          <Sliders size={12} />
          Anti-Ban Reaction Speed
        </div>
        <div className="slider-container">
          <div className="slider-header">
            <span style={{ color: '#94a3b8' }}>Human Delay</span>
            <span style={{ fontWeight: 600, color: '#c4b5fd' }}>~{midDelay} ms</span>
          </div>
          <input
            type="range"
            min="200"
            max="1200"
            step="50"
            value={midDelay}
            onChange={handleDelayChange}
            className="range-input"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
            <span>Turbo (200ms)</span>
            <span>Balanced (500ms)</span>
            <span>Stealth (1200ms)</span>
          </div>
        </div>
      </div>

      {/* Real-time Session Stats */}
      <div className="card">
        <div className="card-title">
          <CheckCircle2 size={12} />
          Session Activity
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value skipped">{stats.totalSkipped}</span>
            <span className="stat-label">Skipped Males</span>
          </div>
          <div className="stat-item">
            <span className="stat-value matched">{stats.femalesMatched}</span>
            <span className="stat-label">Girls Matched</span>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="card">
        <div className="option-row">
          <div className="option-info">
            <Layout size={14} color="#94a3b8" />
            <span>Floating in-video HUD</span>
          </div>
          <label className="switch" style={{ width: 36, height: 20 }}>
            <input
              type="checkbox"
              checked={settings.showInPageHud}
              onChange={handleToggleHud}
            />
            <span className="slider" style={{ borderRadius: 20 }}></span>
          </label>
        </div>

        <div className="option-row">
          <div className="option-info">
            <Volume2 size={14} color="#94a3b8" />
            <span>Sound chime on match</span>
          </div>
          <label className="switch" style={{ width: 36, height: 20 }}>
            <input
              type="checkbox"
              checked={settings.soundAlertOnMatch}
              onChange={handleToggleSound}
            />
            <span className="slider" style={{ borderRadius: 20 }}></span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <span>Shortcut: <strong>Alt + W</strong></span>
        <button className="reset-btn" onClick={handleResetStats}>
          <RefreshCw size={10} style={{ display: 'inline', marginRight: 4 }} />
          Reset Stats
        </button>
      </div>
    </div>
  );
}
