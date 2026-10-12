import { z } from 'zod';

export const LIMITS = {
  rows: 2000,
  columns: 100,
  cells: 50000,
  text: 1000000,
  cellText: 20000,
} as const;
export const CAPTURE_TTL = 30 * 60 * 1000;
export const REQUEST_TTL = 10 * 60 * 1000;

export const tableSchema = z
  .object({
    label: z.string().trim().min(1).max(180),
    rows: z
      .array(z.array(z.string().max(LIMITS.cellText)).min(1).max(LIMITS.columns))
      .min(1)
      .max(LIMITS.rows),
    suggestedHeaderRows: z.number().int().min(0).max(10),
    mergedCells: z.number().int().min(0).max(LIMITS.cells),
    hiddenRows: z.number().int().min(0).max(LIMITS.rows),
  })
  .strict()
  .superRefine((table, ctx) => {
    const width = table.rows[0]?.length ?? 0;
    if (table.rows.some((row) => row.length !== width))
      ctx.addIssue({ code: 'custom', message: 'Non-rectangular table' });
    if (table.rows.length * width > LIMITS.cells)
      ctx.addIssue({ code: 'custom', message: 'Too many cells' });
    if (
      table.rows.reduce((sum, row) => sum + row.reduce((n, value) => n + value.length, 0), 0) >
      LIMITS.text
    ) {
      ctx.addIssue({ code: 'custom', message: 'Too much text' });
    }
    if (table.suggestedHeaderRows > table.rows.length)
      ctx.addIssue({ code: 'custom', message: 'Invalid heading count' });
  });

export const captureSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.number().int().nonnegative(),
    table: tableSchema,
    source: z
      .object({
        title: z.string().max(200),
        url: z
          .string()
          .max(2000)
          .nullable()
          .refine((value) => value === null || sanitizeSourceUrl(value) === value),
        tabId: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    editorTabId: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('capture:start'), tabId: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('sample:open') }).strict(),
  z
    .object({ type: z.literal('table:capture'), token: z.string().uuid(), table: tableSchema })
    .strict(),
  z.object({ type: z.literal('capture:cancel'), token: z.string().uuid() }).strict(),
  z.object({ type: z.literal('capture:discard'), id: z.string().uuid() }).strict(),
]);

export type ExtractedTable = z.infer<typeof tableSchema>;
export type Capture = z.infer<typeof captureSchema>;
export type RuntimeMessage = z.infer<typeof messageSchema>;
export type Reply = { ok: true; id?: string } | { ok: false; error: string };

export function sanitizeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    const result = url.toString();
    return result.length <= 2000 ? result : null;
  } catch {
    return null;
  }
}
