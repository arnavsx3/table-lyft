import type { ExtractedTable } from './schema';

export interface ViewOptions {
  headerRows: number;
  columns: number[];
  names: Record<number, string>;
  trimWhitespace: boolean;
  removeEmptyRows: boolean;
  query: string;
  sort: { column: number; direction: 'asc' | 'desc' } | null;
}

export interface Dataset {
  headers: string[];
  rows: string[][];
}

export function defaultOptions(table: ExtractedTable): ViewOptions {
  return {
    headerRows: table.suggestedHeaderRows,
    columns: table.rows[0]!.map((_, i) => i),
    names: {},
    trimWhitespace: true,
    removeEmptyRows: true,
    query: '',
    sort: null,
  };
}

export function headersFor(table: ExtractedTable, count: number): string[] {
  return table.rows[0]!.map((_, column) => {
    const labels: string[] = [];
    for (const row of table.rows.slice(0, count)) {
      const label = row[column]?.trim();
      if (label && labels.at(-1) !== label) labels.push(label);
    }
    return labels.join(' / ') || `Column ${column + 1}`;
  });
}

export function prepareDataset(table: ExtractedTable, options: ViewOptions): Dataset {
  const width = table.rows[0]!.length;
  const columns = [...new Set(options.columns)].filter(
    (index) => Number.isInteger(index) && index >= 0 && index < width,
  );
  const count = Math.max(0, Math.min(table.rows.length, 10, Math.trunc(options.headerRows) || 0));
  const sourceHeaders = headersFor(table, count);
  const used = new Set<string>();
  const headers = columns.map((index) => {
    const base = options.names[index]?.trim() || sourceHeaders[index]!;
    let label = base,
      suffix = 2;
    while (used.has(label.toLocaleLowerCase())) label = `${base} (${suffix++})`;
    used.add(label.toLocaleLowerCase());
    return label;
  });
  const query = options.query.trim().toLocaleLowerCase();
  let rows = table.rows
    .slice(count)
    .map((row) =>
      columns.map((index) => (options.trimWhitespace ? row[index]!.trim() : row[index]!)),
    );
  if (options.removeEmptyRows)
    rows = rows.filter((row) => row.some((value) => value.trim().length > 0));
  if (query)
    rows = rows.filter((row) => row.some((value) => value.toLocaleLowerCase().includes(query)));
  const sortColumn = options.sort ? columns.indexOf(options.sort.column) : -1;
  if (options.sort && sortColumn >= 0) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const direction = options.sort.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => direction * collator.compare(a[sortColumn]!, b[sortColumn]!));
  }
  return { headers, rows };
}
