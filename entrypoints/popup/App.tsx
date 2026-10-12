import {
  AlertTriangle,
  ArrowRight,
  FlaskConical,
  Globe2,
  LockKeyhole,
  MousePointer2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { sanitizeSourceUrl } from '@/core/schema';
import { extensionApi, send } from '@/extension/client';
import { Brand } from '@/ui/Brand';

export default function App() {
  const [tab, setTab] = useState<{ id: number; title: string; url: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void extensionApi()
      .then((api) => api.tabs.query({ active: true, currentWindow: true }))
      .then(([active]) => {
        if (current && active?.id !== undefined)
          setTab({ id: active.id, title: active.title || 'Untitled page', url: active.url || '' });
      })
      .catch(() => {
        if (current) setError('Open TableLyft from your browser toolbar.');
      })
      .finally(() => {
        if (current) setReady(true);
      });
    return () => {
      current = false;
    };
  }, []);
  const supported = tab ? sanitizeSourceUrl(tab.url) !== null : false;
  const run = async (sample: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const reply = await send(
        sample ? { type: 'sample:open' } : { type: 'capture:start', tabId: tab!.id },
      );
      if (!reply.ok) {
        setError(reply.error);
        return;
      }
      window.close();
    } catch {
      setError('TableLyft could not start. Reload the extension and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="popup">
      <header>
        <Brand />
        <span className="mono muted">0.1</span>
      </header>
      <section className="current-page">
        <span className="eyebrow">Current page</span>
        <div className="page-title">
          <Globe2 size={19} />
          <div>
            <strong title={tab?.title}>
              {ready ? tab?.title || 'No active page' : 'Loading page...'}
            </strong>
            <span className="muted">
              {supported ? new URL(tab!.url).hostname : ready ? 'Page unavailable' : ''}
            </span>
          </div>
        </div>
      </section>
      {error && (
        <div className="error" role="alert">
          <AlertTriangle />
          <p>{error}</p>
        </div>
      )}
      <button
        type="button"
        className="button primary select-table"
        disabled={!ready || !supported || busy}
        onClick={() => void run(false)}
      >
        <MousePointer2 />
        {busy ? 'Opening...' : 'Select table'}
        <ArrowRight />
      </button>
      {!supported && ready && !error && (
        <p className="unavailable" role="status">
          This page cannot be inspected.
        </p>
      )}
      <button
        type="button"
        className="button sample"
        disabled={busy}
        onClick={() => void run(true)}
      >
        <FlaskConical />
        Open sample
      </button>
      <footer>
        <span className="status-label">
          <LockKeyhole />
          Local session
        </span>
        <span className="mono">CSV / TSV / MD</span>
      </footer>
    </main>
  );
}
