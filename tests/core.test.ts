import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { csvFilename, delimited, markdown } from '../src/core/export';
import { extractTable } from '../src/core/extract';
import { sampleTable } from '../src/core/sample';
import { sanitizeSourceUrl, tableSchema } from '../src/core/schema';
import { defaultOptions, headersFor, prepareDataset } from '../src/core/transform';

function table(html: string) {
  document.body.innerHTML = html;
  return document.querySelector('table')!;
}

describe('HTML extraction', () => {
  it('reads native rows, normalizes text and detects headings', () => {
    const result = extractTable(
      table(
        '<table><caption>Results</caption><tr><th>Name</th><th>Value</th></tr><tr><td> A&nbsp; B </td><td><p>One</p><p>Two<br>Three</p></td></tr></table>',
      ),
    );
    expect(result.label).toBe('Results');
    expect(result.suggestedHeaderRows).toBe(1);
    expect(result.rows).toEqual([
      ['Name', 'Value'],
      ['A B', 'One\n\nTwo\nThree'],
    ]);
  });
  it('expands rowspan and colspan into a rectangular matrix', () => {
    const result = extractTable(
      table(
        '<table><thead><tr><th rowspan="2">Region</th><th colspan="2">Sales</th></tr><tr><th>Q1</th><th>Q2</th></tr></thead><tbody><tr><td rowspan="2">North</td><td>10</td><td>20</td></tr><tr><td>30</td><td>40</td></tr></tbody></table>',
      ),
    );
    expect(result.rows).toEqual([
      ['Region', 'Sales', 'Sales'],
      ['Region', 'Q1', 'Q2'],
      ['North', '10', '20'],
      ['North', '30', '40'],
    ]);
    expect(result.suggestedHeaderRows).toBe(2);
    expect(headersFor(result, 2)).toEqual(['Region', 'Sales / Q1', 'Sales / Q2']);
  });
  it('bounds rowspan zero to the current row group', () => {
    const result = extractTable(
      table(
        '<table><tbody><tr><td rowspan="0">A</td><td>1</td></tr><tr><td>2</td></tr></tbody><tbody><tr><td>B</td><td>3</td></tr></tbody></table>',
      ),
    );
    expect(result.rows).toEqual([
      ['A', '1'],
      ['A', '2'],
      ['B', '3'],
    ]);
  });
  it('excludes hidden text, rows, columns, nested tables and form controls', () => {
    const result = extractTable(
      table(
        '<table><tr><td>Visible <span hidden>secret</span><input value="password"><textarea>private</textarea><select><option>choice</option></select><button>Delete</button><table><tr><td>nested</td></tr></table></td><td style="display:none">hidden column</td><td>Last</td></tr><tr hidden><td>hidden row</td></tr></table>',
      ),
    );
    expect(result.rows).toEqual([['Visible', 'Last']]);
    expect(result.hiddenRows).toBe(1);
  });
  it('pads short rows without capturing nested table rows', () => {
    expect(
      extractTable(table('<table><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></table>')).rows,
    ).toEqual([
      ['A', 'B'],
      ['C', ''],
    ]);
  });
  it('does not assume a plain first row contains headings', () => {
    expect(extractTable(table('<table><tr><td>1</td></tr></table>')).suggestedHeaderRows).toBe(0);
  });
  it('rejects detached, hidden and empty tables', () => {
    expect(() => extractTable(document.createElement('table'))).toThrow(/no longer/);
    expect(() => extractTable(table('<table hidden><tr><td>x</td></tr></table>'))).toThrow(
      /hidden/,
    );
    expect(() => extractTable(table('<table></table>'))).toThrow(/no rows/);
  });
  it('rejects oversized dimensions and cell text without truncation', () => {
    expect(() => extractTable(table('<table><tr><td colspan="101">x</td></tr></table>'))).toThrow(
      /100-column/,
    );
    expect(() =>
      extractTable(table(`<table>${'<tr><td>x</td></tr>'.repeat(2001)}</table>`)),
    ).toThrow(/2,000-row/);
    expect(() =>
      extractTable(table(`<table><tr><td>${'x'.repeat(20001)}</td></tr></table>`)),
    ).toThrow(/20,000/);
  });
});

describe('preview transformations', () => {
  it('uses a pure pipeline without mutating the capture', () => {
    const original = structuredClone(sampleTable);
    const options = {
      ...defaultOptions(sampleTable),
      columns: [0, 1],
      query: 'hydration',
      sort: { column: 0, direction: 'asc' as const },
    };
    expect(prepareDataset(sampleTable, options).rows).toEqual([
      ['Creek Filter', 'Hydration'],
      ['Horizon Flask', 'Hydration'],
    ]);
    expect(sampleTable).toEqual(original);
  });
  it('keeps zero filtered rows and zero columns empty', () => {
    expect(
      prepareDataset(sampleTable, { ...defaultOptions(sampleTable), query: 'no-such-product' })
        .rows,
    ).toEqual([]);
    expect(
      prepareDataset(sampleTable, { ...defaultOptions(sampleTable), columns: [] }).headers,
    ).toEqual([]);
  });
  it('searches only included columns', () => {
    expect(
      prepareDataset(sampleTable, {
        ...defaultOptions(sampleTable),
        columns: [0],
        query: 'hydration',
      }).rows,
    ).toEqual([]);
  });
  it('makes renamed headings unique and filters invalid column indexes', () => {
    expect(
      prepareDataset(sampleTable, {
        ...defaultOptions(sampleTable),
        columns: [0, 1, 1, -1, 999],
        names: { 0: 'Name', 1: 'name' },
      }).headers,
    ).toEqual(['Name', 'name (2)']);
  });
  it('sorts naturally and stably without converting source strings', () => {
    const source = {
      ...sampleTable,
      suggestedHeaderRows: 0,
      rows: [
        ['10', 'A'],
        ['2', 'B'],
        ['02', 'C'],
      ],
    };
    expect(
      prepareDataset(source, { ...defaultOptions(source), sort: { column: 0, direction: 'asc' } })
        .rows,
    ).toEqual([
      ['2', 'B'],
      ['02', 'C'],
      ['10', 'A'],
    ]);
  });
  it('bounds headers and controls trimming/empty rows', () => {
    const source = { ...sampleTable, suggestedHeaderRows: 0, rows: [[' A '], [' ']] };
    expect(
      prepareDataset(source, {
        ...defaultOptions(source),
        trimWhitespace: false,
        removeEmptyRows: false,
      }).rows,
    ).toEqual([[' A '], [' ']]);
    expect(prepareDataset(source, { ...defaultOptions(source), headerRows: 99 }).rows).toEqual([]);
  });
});

describe('exports', () => {
  const data = {
    headers: ['Name', 'Notes'],
    rows: [
      ['A, B', 'Line 1\n"Line 2"'],
      ['Unicode', '東京'],
    ],
  };
  it.each([',', ';', '\t'] as const)(
    'round-trips %j separators, quotes, newlines and Unicode',
    (delimiter) => {
      const output = delimited(data, { delimiter, headings: true, protect: true });
      expect(Papa.parse<string[]>(output, { delimiter }).data).toEqual([
        data.headers,
        ...data.rows,
      ]);
    },
  );
  it.each([
    '=HYPERLINK("https://example.com")',
    '+cmd',
    '-10',
    '@SUM(A1)',
    '  =1+1',
    '\t=1',
    '\rtext',
  ])('protects formula-like values %j', (value) => {
    const output = delimited(
      { headers: ['Cell'], rows: [[value]] },
      { delimiter: ',', headings: false, protect: true },
    );
    expect(Papa.parse<string[]>(output).data[0]?.[0]).toBe(`'${value}`);
  });
  it('protects headings and permits an explicit opt-out', () => {
    const source = { headers: ['=header'], rows: [['=2+2']] };
    expect(
      Papa.parse<string[]>(delimited(source, { delimiter: ',', headings: true, protect: true }))
        .data,
    ).toEqual([["'=header"], ["'=2+2"]]);
    expect(delimited(source, { delimiter: ',', headings: false, protect: false })).toBe('=2+2');
  });
  it('escapes Markdown pipes, markup and multiline text', () => {
    const result = markdown({ headers: ['A|B'], rows: [['<img>\n[x](javascript:bad)']] });
    expect(result).toContain('A\\|B');
    expect(result).toContain('&lt;img&gt;<br>\\[x\\]\\(javascript:bad\\)');
  });
  it('handles empty output and rejects zero columns', () => {
    expect(
      delimited({ headers: ['A'], rows: [] }, { delimiter: ',', headings: false, protect: true }),
    ).toBe('');
    expect(() => markdown({ headers: [], rows: [] })).toThrow(/column/);
  });
  it('makes filesystem-safe export filenames', () => {
    expect(csvFilename('A/B: report')).toBe('A-B- report.csv');
    expect(csvFilename('')).toBe('tablelyft-export.csv');
  });
});

describe('capture boundary', () => {
  it('rejects nonrectangular and excessive heading values', () => {
    expect(tableSchema.safeParse({ ...sampleTable, rows: [['A'], ['B', 'C']] }).success).toBe(
      false,
    );
    expect(
      tableSchema.safeParse({ ...sampleTable, rows: [['A']], suggestedHeaderRows: 2 }).success,
    ).toBe(false);
  });
  it('removes credentials, query strings and fragments from source URLs', () => {
    expect(sanitizeSourceUrl('https://user:pass@example.com/report?token=secret#private')).toBe(
      'https://example.com/report',
    );
    expect(sanitizeSourceUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeSourceUrl('not a URL')).toBeNull();
  });
});
