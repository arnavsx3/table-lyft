import Papa from 'papaparse';
import type { Dataset } from './transform';

// biome-ignore lint/suspicious/noControlCharactersInRegex: Formula prefixes can be hidden behind control bytes.
export const formulaPattern = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/u;

export function delimited(
  dataset: Dataset,
  options: { delimiter: ',' | ';' | '\t'; headings: boolean; protect: boolean },
): string {
  if (!dataset.headers.length) throw new Error('Select at least one column.');
  const rows = options.headings ? [dataset.headers, ...dataset.rows] : dataset.rows;
  return Papa.unparse(rows, {
    delimiter: options.delimiter,
    newline: '\r\n',
    escapeFormulae: options.protect ? formulaPattern : false,
  });
}

function markdownText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_[\]{}()!|])/g, '\\$1')
    .replace(/\r\n?|\n/g, '<br>');
}

export function markdown(dataset: Dataset, headings = true): string {
  if (!dataset.headers.length) throw new Error('Select at least one column.');
  const line = (row: string[]) => `| ${row.map(markdownText).join(' | ')} |`;
  return [
    line(headings ? dataset.headers : dataset.headers.map(() => '')),
    line(dataset.headers.map(() => '---')),
    ...dataset.rows.map(line),
  ].join('\n');
}

export function csvFilename(label: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: File names must exclude control bytes.
  const unsafeCharacters = /[<>:"/\\|?*\u0000-\u001f]/g;
  const name = label
    .normalize('NFKC')
    .replace(unsafeCharacters, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 90);
  const safe = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
  return `${safe || 'tablelyft-export'}.csv`;
}
