import { type ExtractedTable, LIMITS, tableSchema } from './schema';

const ignoredTags = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
]);
const blockTags = new Set([
  'P',
  'DIV',
  'LI',
  'UL',
  'OL',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'PRE',
]);

export function isRendered(element: Element, cache = new WeakMap<Element, boolean>()): boolean {
  const cached = cache.get(element);
  if (cached !== undefined) return cached;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const visible =
    !element.hasAttribute('hidden') &&
    element.getAttribute('aria-hidden') !== 'true' &&
    style?.display !== 'none' &&
    style?.visibility !== 'hidden' &&
    style?.visibility !== 'collapse' &&
    (!element.parentElement || isRendered(element.parentElement, cache));
  cache.set(element, visible);
  return visible;
}

function textOf(
  root: Element,
  cache: WeakMap<Element, boolean>,
  budget: { visited: number },
): string {
  const pieces: string[] = [];
  let size = 0;
  const add = (value: string) => {
    size += value.length;
    if (size > LIMITS.cellText) throw new Error('A cell exceeds the 20,000-character limit.');
    pieces.push(value);
  };
  const visit = (node: Node) => {
    if (++budget.visited > 200000) throw new Error('This table is too complex to capture.');
    if (node.nodeType === 3) {
      add(node.nodeValue ?? '');
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (
      ignoredTags.has(element.tagName) ||
      (element.tagName === 'TABLE' && element !== root) ||
      !isRendered(element, cache)
    )
      return;
    if (element.tagName === 'BR') {
      add('\n');
      return;
    }
    const block = element !== root && blockTags.has(element.tagName);
    if (block) add('\n');
    for (const child of element.childNodes) visit(child);
    if (block) add('\n');
  };
  visit(root);
  return pieces
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function tableLabel(table: HTMLTableElement, index = 0): string {
  const caption = table.caption ? textOf(table.caption, new WeakMap(), { visited: 0 }) : '';
  return (caption || table.getAttribute('aria-label')?.trim() || `Table ${index + 1}`).slice(
    0,
    180,
  );
}

export function extractTable(table: HTMLTableElement, index = 0): ExtractedTable {
  if (!table.isConnected) throw new Error('This table is no longer on the page. Select it again.');
  const cache = new WeakMap<Element, boolean>();
  if (!isRendered(table, cache)) throw new Error('This table is hidden.');
  const sourceRows = Array.from(table.rows);
  if (!sourceRows.length) throw new Error('This table has no rows.');
  if (sourceRows.length > LIMITS.rows) throw new Error('This table exceeds the 2,000-row limit.');
  const groupEnds = new Map<Element | null, number>();
  sourceRows.forEach((row, i) => {
    groupEnds.set(row.parentElement, i);
  });
  const grid: string[][] = sourceRows.map(() => []);
  const visibleColumns = new Set<number>();
  const visibleRows: number[] = [];
  const budget = { visited: 0 };
  let cells = 0,
    textSize = 0,
    mergedCells = 0,
    suggestedHeaderRows = 0;
  let readingHeaders = true;

  sourceRows.forEach((row, rowIndex) => {
    const rowVisible = isRendered(row, cache);
    if (rowVisible) {
      visibleRows.push(rowIndex);
      const isHeader =
        row.parentElement?.tagName === 'THEAD' ||
        (row.cells.length > 0 && Array.from(row.cells).every((cell) => cell.tagName === 'TH'));
      if (readingHeaders && isHeader) suggestedHeaderRows++;
      else readingHeaders = false;
    }
    let column = 0;
    for (const cell of row.cells) {
      const width = cell.colSpan;
      const groupRemaining = (groupEnds.get(row.parentElement) ?? rowIndex) - rowIndex + 1;
      const height = cell.rowSpan === 0 ? groupRemaining : Math.min(cell.rowSpan, groupRemaining);
      while (grid[rowIndex]?.[column] !== undefined) column++;
      if (column + width > LIMITS.columns)
        throw new Error('This table exceeds the 100-column limit.');
      const cellVisible = rowVisible && isRendered(cell, cache);
      const value = cellVisible ? textOf(cell, cache, budget) : '';
      if (width > 1 || height > 1) mergedCells++;
      for (let r = rowIndex; r < rowIndex + height; r++) {
        for (let c = column; c < column + width; c++) {
          if (grid[r]?.[c] !== undefined)
            throw new Error('This table has overlapping merged cells.');
          if (++cells > LIMITS.cells) throw new Error('This table exceeds the 50,000-cell limit.');
          textSize += value.length;
          if (textSize > LIMITS.text) throw new Error('This table exceeds the text-size limit.');
          grid[r]![c] = value;
          if (cellVisible) visibleColumns.add(c);
        }
      }
      column += width;
    }
  });
  const columns = Array.from(visibleColumns).sort((a, b) => a - b);
  if (!visibleRows.length || !columns.length) throw new Error('This table has no rendered cells.');
  if (visibleRows.length * columns.length > LIMITS.cells)
    throw new Error('This table exceeds the 50,000-cell limit.');
  return tableSchema.parse({
    label: tableLabel(table, index),
    rows: visibleRows.map((row) => columns.map((column) => grid[row]?.[column] ?? '')),
    suggestedHeaderRows: Math.min(suggestedHeaderRows, 10),
    mergedCells,
    hiddenRows: sourceRows.length - visibleRows.length,
  });
}
