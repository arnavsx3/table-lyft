import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Columns3,
  Download,
  ExternalLink,
  FileCode2,
  FlaskConical,
  LockKeyhole,
  RotateCcw,
  Search,
  SearchX,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { csvFilename, delimited, markdown } from '@/core/export';
import { sampleTable } from '@/core/sample';
import type { Capture } from '@/core/schema';
import { defaultOptions, headersFor, prepareDataset, type ViewOptions } from '@/core/transform';
import { goToSource, isExtension, loadCapture, send } from '@/extension/client';
import { Brand } from '@/ui/Brand';

const PAGE_SIZE = 100;

export default function App() {
  const [capture, setCapture] = useState<Capture | null>(null);
  const [options, setOptions] = useState<ViewOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [headings, setHeadings] = useState(true);
  const [protect, setProtect] = useState(true);
  const [separator, setSeparator] = useState<',' | ';' | '\t'>(',');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let current = true;
    const id = new URLSearchParams(location.search).get('id');
    const read = async () => {
      if (!isExtension())
        return {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          table: sampleTable,
          source: { title: 'Sample dataset', url: null, tabId: null },
          editorTabId: null,
        } satisfies Capture;
      return id ? loadCapture(id) : null;
    };
    void read()
      .then((value) => {
        if (!current) return;
        setCapture(value);
        setOptions(value ? defaultOptions(value.table) : null);
        setHeadings((value?.table.suggestedHeaderRows ?? 0) > 0);
      })
      .catch(() => {
        if (current) setError('This capture could not be loaded.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);
  const dataset = useMemo(
    () => (capture && options ? prepareDataset(capture.table, options) : { headers: [], rows: [] }),
    [capture, options],
  );
  const availableHeaders = useMemo(
    () => (capture && options ? headersFor(capture.table, options.headerRows) : []),
    [capture, options],
  );
  const canExport = dataset.headers.length > 0 && dataset.rows.length > 0;
  const update = (patch: Partial<ViewOptions>) => {
    setPage(0);
    setOptions((previous) => (previous ? { ...previous, ...patch } : previous));
  };
  const reset = () => {
    if (!capture) return;
    setPage(0);
    setOptions(defaultOptions(capture.table));
    setHeadings(capture.table.suggestedHeaderRows > 0);
    setProtect(true);
    setSeparator(',');
    setError(null);
    setStatus(null);
  };
  const copy = async (format: 'spreadsheet' | 'markdown') => {
    if (!canExport) return;
    try {
      const text =
        format === 'markdown'
          ? markdown(dataset, headings)
          : delimited(dataset, { delimiter: '\t', headings, protect });
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${dataset.rows.length} rows`);
      setError(null);
    } catch {
      setError('Clipboard access failed. Your data is unchanged; CSV download is still available.');
    }
  };
  const download = () => {
    if (!capture || !canExport) return;
    try {
      const text = delimited(dataset, { delimiter: separator, headings, protect });
      const url = URL.createObjectURL(
        new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = csvFilename(capture.table.label);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus(`Exported ${dataset.rows.length} rows`);
      setError(null);
    } catch {
      setError('CSV export failed. Your data is unchanged.');
    }
  };
  const openSample = async () => {
    try {
      const reply = await send({ type: 'sample:open' });
      if (!reply.ok) setError(reply.error);
    } catch {
      setError('The sample could not be opened. Reload the extension.');
    }
  };
  const discard = async () => {
    if (!capture || !window.confirm('Discard this capture?')) return;
    try {
      if (isExtension()) {
        const reply = await send({ type: 'capture:discard', id: capture.id });
        if (!reply.ok) throw new Error();
      }
      setCapture(null);
      setOptions(null);
      setStatus(null);
      setError(null);
      history.replaceState({}, '', location.pathname);
    } catch {
      setError('The capture could not be discarded.');
    }
  };
  const toggleColumn = (column: number) => {
    if (!options) return;
    const included = options.columns.includes(column)
      ? options.columns.filter((index) => index !== column)
      : [...options.columns, column].sort((a, b) => a - b);
    update({ columns: included });
  };
  const toggleSort = (column: number) => {
    const current = options?.sort;
    update({
      sort:
        current?.column !== column
          ? { column, direction: 'asc' }
          : current.direction === 'asc'
            ? { column, direction: 'desc' }
            : null,
    });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <span className="workspace-name">Workspace</span>
        <div className="header-right">
          <span className="status-label">
            <LockKeyhole />
            Local session
          </span>
          <span className="version mono">0.1.0</span>
        </div>
      </header>
      {loading ? (
        <div className="empty-state" role="status">
          <Table2 />
          <h1>Loading capture...</h1>
        </div>
      ) : !capture || !options ? (
        <div className="empty-state empty-workspace">
          <Table2 />
          <h1>No active capture</h1>
          {error && <p role="alert">{error}</p>}
          <button type="button" className="button primary" onClick={() => void openSample()}>
            <FlaskConical />
            Open sample
          </button>
        </div>
      ) : (
        <>
          <section className="workspace-toolbar">
            <div className="capture-heading">
              <div className="capture-kicker">
                <span className="eyebrow">
                  {capture.source.url ? 'Captured table' : 'Sample dataset'}
                </span>
                <span className="capture-badge mono">{capture.table.rows.length} loaded rows</span>
              </div>
              <h1>{capture.table.label}</h1>
              <div className="source-line">
                {capture.source.url ? (
                  <a
                    href={capture.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={capture.source.url}
                  >
                    {new URL(capture.source.url).hostname}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span>Outdoor equipment</span>
                )}
                {capture.source.tabId !== null && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      void goToSource(capture.source.tabId!).catch(() =>
                        setError('The source tab is no longer available.'),
                      )
                    }
                  >
                    Back to page
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="export-actions">
              <button
                type="button"
                className="button"
                disabled={!canExport}
                onClick={() => void copy('markdown')}
              >
                <FileCode2 />
                Markdown
              </button>
              <button type="button" className="button" disabled={!canExport} onClick={download}>
                <Download />
                CSV
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!canExport}
                onClick={() => void copy('spreadsheet')}
              >
                <Clipboard />
                Copy spreadsheet
              </button>
            </div>
          </section>
          {error && (
            <div className="workspace-notice error" role="alert">
              <AlertTriangle />
              <p>{error}</p>
              <button
                type="button"
                className="icon-button"
                title="Dismiss error"
                aria-label="Dismiss error"
                onClick={() => setError(null)}
              >
                <X />
              </button>
            </div>
          )}
          {status && (
            <div className="success-notice" role="status">
              <Check size={16} />
              {status}
            </div>
          )}
          <div className="workspace-body">
            <aside className="settings-panel" aria-label="Table settings">
              <section className="settings-section">
                <div className="section-title">
                  <h2>
                    Columns{' '}
                    <span className="mono">
                      {options.columns.length}/{availableHeaders.length}
                    </span>
                  </h2>
                  <button
                    type="button"
                    className="icon-button"
                    title="Include all columns"
                    aria-label="Include all columns"
                    onClick={() => update({ columns: availableHeaders.map((_, index) => index) })}
                  >
                    <Columns3 />
                  </button>
                </div>
                <div className="column-list">
                  {availableHeaders.map((name, index) => (
                    <div
                      className={`column-item ${options.columns.includes(index) ? '' : 'excluded'}`}
                      key={index}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Include column ${index + 1}`}
                        checked={options.columns.includes(index)}
                        onChange={() => toggleColumn(index)}
                      />
                      <span className="column-number mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <input
                        type="text"
                        aria-label={`Rename column ${index + 1}`}
                        value={options.names[index] ?? name}
                        maxLength={180}
                        title={options.names[index] ?? name}
                        onChange={(event) =>
                          update({ names: { ...options.names, [index]: event.target.value } })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
              <section className="settings-section">
                <div className="section-title">
                  <h2>Preparation</h2>
                </div>
                <label className="field-row" htmlFor="header-rows">
                  Heading rows
                  <input
                    id="header-rows"
                    type="number"
                    min={0}
                    max={Math.min(10, capture.table.rows.length)}
                    value={options.headerRows}
                    onChange={(event) => {
                      const value = Math.max(
                        0,
                        Math.min(10, capture.table.rows.length, Number(event.target.value) || 0),
                      );
                      update({ headerRows: value });
                      setHeadings(value > 0);
                    }}
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={options.trimWhitespace}
                    onChange={(event) => update({ trimWhitespace: event.target.checked })}
                  />
                  Trim whitespace
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={options.removeEmptyRows}
                    onChange={(event) => update({ removeEmptyRows: event.target.checked })}
                  />
                  Remove empty rows
                </label>
              </section>
              <section className="settings-section">
                <div className="section-title">
                  <h2>Export</h2>
                </div>
                <label className="field-row" htmlFor="separator">
                  CSV separator
                  <select
                    id="separator"
                    value={separator}
                    onChange={(event) => setSeparator(event.target.value as ',' | ';' | '\t')}
                  >
                    <option value=",">Comma</option>
                    <option value=";">Semicolon</option>
                    <option value={'\t'}>Tab</option>
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={headings}
                    onChange={(event) => setHeadings(event.target.checked)}
                  />
                  Include headings
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={protect}
                    onChange={(event) => setProtect(event.target.checked)}
                  />
                  Protect spreadsheet formulas
                </label>
                {!protect && (
                  <div className="formula-warning" role="alert">
                    <AlertTriangle size={14} />
                    Formula protection off
                  </div>
                )}
              </section>
              <div className="settings-bottom">
                <button type="button" className="button" onClick={reset}>
                  <RotateCcw />
                  Reset changes
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  title="Discard capture"
                  aria-label="Discard capture"
                  onClick={() => void discard()}
                >
                  <Trash2 />
                </button>
              </div>
            </aside>
            <main className="data-panel">
              <div className="data-toolbar">
                <div className="data-title">
                  <Table2 size={17} />
                  <h2>Preview</h2>
                  <span className="mono">
                    {dataset.rows.length} rows<span className="count-dot">/</span>
                    {dataset.headers.length} columns
                  </span>
                </div>
                <div className="search-field">
                  <Search size={16} />
                  <input
                    type="search"
                    aria-label="Filter rows"
                    placeholder="Filter rows"
                    value={options.query}
                    onChange={(event) => update({ query: event.target.value })}
                  />
                  {options.query && (
                    <button
                      type="button"
                      className="icon-button"
                      title="Clear filter"
                      aria-label="Clear filter"
                      onClick={() => update({ query: '' })}
                    >
                      <X />
                    </button>
                  )}
                </div>
              </div>
              {dataset.headers.length === 0 ? (
                <div className="empty-state">
                  <Columns3 />
                  <h2>No columns selected</h2>
                  <button
                    type="button"
                    className="button"
                    onClick={() => update({ columns: availableHeaders.map((_, index) => index) })}
                  >
                    Include all columns
                  </button>
                </div>
              ) : dataset.rows.length === 0 ? (
                <div className="empty-state">
                  <SearchX />
                  <h2>{options.query ? 'No matching rows' : 'No data rows'}</h2>
                  {options.query && (
                    <button type="button" className="button" onClick={() => update({ query: '' })}>
                      Clear filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid-scroll">
                  <table className="preview-grid" aria-label="Table preview">
                    <thead>
                      <tr>
                        <th className="row-number" scope="col">
                          #
                        </th>
                        {dataset.headers.map((header, index) => {
                          const column = options.columns[index]!;
                          const sorting =
                            options.sort?.column === column ? options.sort.direction : null;
                          const SortIcon =
                            sorting === 'asc'
                              ? ArrowUp
                              : sorting === 'desc'
                                ? ArrowDown
                                : ArrowUpDown;
                          return (
                            <th
                              scope="col"
                              key={column}
                              aria-sort={
                                sorting === 'asc'
                                  ? 'ascending'
                                  : sorting === 'desc'
                                    ? 'descending'
                                    : 'none'
                              }
                            >
                              <button
                                type="button"
                                title={`Sort by ${header}`}
                                aria-label={`Sort by ${header}`}
                                onClick={() => toggleSort(column)}
                              >
                                <span>{header}</span>
                                <SortIcon size={13} />
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {dataset.rows
                        .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                        .map((row, rowIndex) => (
                          <tr key={page * PAGE_SIZE + rowIndex}>
                            <th className="row-number mono" scope="row">
                              {page * PAGE_SIZE + rowIndex + 1}
                            </th>
                            {row.map((value, index) => (
                              <td key={options.columns[index]}>
                                <div title={value}>
                                  {value || <span className="blank-cell">-</span>}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <footer className="data-footer">
                <span className="mono">
                  {dataset.rows.length
                    ? `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, dataset.rows.length)} of ${dataset.rows.length}`
                    : '0 rows'}
                </span>
                <div className="capture-notes">
                  {capture.table.mergedCells > 0 && (
                    <span>{capture.table.mergedCells} merged cells</span>
                  )}
                  {capture.table.hiddenRows > 0 && (
                    <span>{capture.table.hiddenRows} hidden rows excluded</span>
                  )}
                </div>
                <div className="pagination">
                  <button
                    type="button"
                    className="icon-button"
                    title="Previous page"
                    aria-label="Previous page"
                    disabled={page === 0}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    <ChevronLeft />
                  </button>
                  <span className="mono">
                    {page + 1} / {Math.max(1, Math.ceil(dataset.rows.length / PAGE_SIZE))}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    title="Next page"
                    aria-label="Next page"
                    disabled={(page + 1) * PAGE_SIZE >= dataset.rows.length}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    <ChevronRight />
                  </button>
                </div>
              </footer>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
