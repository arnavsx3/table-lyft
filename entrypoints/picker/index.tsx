import { AlertTriangle, ArrowUpRight, LoaderCircle, Table2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { extractTable, isRendered, tableLabel } from '@/core/extract';
import type { Reply } from '@/core/schema';
import { pickerStyles } from './style';

declare global {
  var tableLyftPickerInstalled: boolean | undefined;
}

export default defineUnlistedScript(() => {
  if (globalThis.tableLyftPickerInstalled) return;
  globalThis.tableLyftPickerInstalled = true;
  let closeCurrent: (() => void) | null = null;
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (
      sender.id !== browser.runtime.id ||
      message?.type !== 'picker:open' ||
      typeof message.token !== 'string'
    )
      return;
    closeCurrent?.();
    const host = document.createElement('div');
    host.dataset.tablelyftPicker = '';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = pickerStyles;
    const container = document.createElement('div');
    shadow.append(style, container);
    document.documentElement.append(host);
    const root = createRoot(container);
    const token: string = message.token;
    const close = () => {
      root.unmount();
      host.remove();
      closeCurrent = null;
      void browser.runtime.sendMessage({ type: 'capture:cancel', token }).catch(() => {});
    };
    closeCurrent = close;
    root.render(<Picker host={host} token={token} close={close} />);
    respond({ ok: true });
  });
});

function Picker({ host, token, close }: { host: HTMLElement; token: string; close: () => void }) {
  const [tables] = useState(() =>
    Array.from(document.querySelectorAll('table'))
      .slice(0, 1000)
      .filter(
        (table) =>
          isRendered(table) && table.getBoundingClientRect().width > 0 && table.rows.length > 0,
      )
      .slice(0, 100),
  );
  const [active, setActive] = useState<HTMLTableElement | null>(tables[0] ?? null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = async (table: HTMLTableElement) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = extractTable(table, tables.indexOf(table));
      const reply = (await browser.runtime.sendMessage({
        type: 'table:capture',
        token,
        table: result,
      })) as Reply;
      if (!reply?.ok) {
        setError(reply && !reply.ok ? reply.error : 'The extension did not respond.');
        return;
      }
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'This table could not be captured.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const update = () => setRect(active?.isConnected ? active.getBoundingClientRect() : null);
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        close();
      }
    };
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || event.composedPath().includes(host) || busy) return;
      const table = event.target instanceof Element ? event.target.closest('table') : null;
      if (!table || !tables.includes(table)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void select(table);
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('click', click, true);
    };
  });
  return (
    <>
      {rect && (
        <div
          className="lyft-outline"
          aria-hidden="true"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      )}
      <aside className="lyft-panel" role="dialog" aria-label="Select a table">
        <header>
          <Table2 size={21} />
          <strong>TableLyft</strong>
          <span>
            {tables.length} {tables.length === 1 ? 'table' : 'tables'}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            title="Cancel selection"
            aria-label="Cancel selection"
          >
            <X size={18} />
          </button>
        </header>
        {busy && (
          <div className="lyft-progress" role="status">
            <LoaderCircle size={16} />
            Capturing table...
          </div>
        )}
        {error && (
          <div className="lyft-error" role="alert">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}
        {tables.length === 0 ? (
          <div className="lyft-empty">
            <Table2 size={28} />
            <strong>No HTML tables found</strong>
          </div>
        ) : (
          <div className="lyft-list">
            {tables.map((table, index) => {
              let label = `Table ${index + 1}`;
              try {
                label = tableLabel(table, index);
              } catch {
                /* A malformed caption must not prevent selection. */
              }
              return (
                <button
                  type="button"
                  className={active === table ? 'active' : ''}
                  key={index}
                  disabled={busy}
                  onMouseEnter={() => setActive(table)}
                  onFocus={() => setActive(table)}
                  onClick={() => void select(table)}
                >
                  <span className="lyft-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="lyft-table">
                    <strong>{label}</strong>
                    <small>{table.rows.length} loaded rows</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
          </div>
        )}
        <footer>
          HTML tables<span>Main frame</span>
        </footer>
      </aside>
    </>
  );
}
