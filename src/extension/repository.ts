import { z } from 'zod';
import { CAPTURE_TTL, type Capture, captureSchema, REQUEST_TTL } from '../core/schema';

export interface SessionArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

const capturePrefix = 'tablelyft:capture:';
const pendingPrefix = 'tablelyft:pending:';
const pendingSchema = z
  .object({
    token: z.string().uuid(),
    createdAt: z.number().int().nonnegative(),
    documentId: z.string().min(1).max(200),
    source: captureSchema.shape.source,
  })
  .strict();
export type PendingCapture = z.infer<typeof pendingSchema>;

export class CaptureRepository {
  private claimed = new Map<string, number>();
  private saving: Promise<void> = Promise.resolve();
  constructor(
    private area: SessionArea,
    private now: () => number = Date.now,
  ) {}

  async prune() {
    const values = await this.area.get(null);
    const expired = Object.entries(values)
      .filter(([key, value]) => {
        if (key.startsWith(capturePrefix)) {
          const parsed = captureSchema.safeParse(value);
          return (
            !parsed.success ||
            key !== `${capturePrefix}${parsed.data.id}` ||
            this.expired(parsed.data.createdAt, CAPTURE_TTL)
          );
        }
        if (key.startsWith(pendingPrefix)) {
          const parsed = pendingSchema.safeParse(value);
          return !parsed.success || this.expired(parsed.data.createdAt, REQUEST_TTL);
        }
        return false;
      })
      .map(([key]) => key);
    if (expired.length) await this.area.remove(expired);
    for (const [token, deadline] of this.claimed)
      if (deadline <= this.now()) this.claimed.delete(token);
  }

  private expired(createdAt: number, ttl: number) {
    return createdAt > this.now() || this.now() - createdAt >= ttl;
  }

  async load(id: string): Promise<Capture | null> {
    await this.prune();
    const key = `${capturePrefix}${id}`;
    const parsed = captureSchema.safeParse((await this.area.get(key))[key]);
    return parsed.success && parsed.data.id === id ? parsed.data : null;
  }

  save(capture: Capture): Promise<void> {
    // A single worker may receive captures from several tabs at once.
    const next = this.saving.then(() => this.saveRecord(capture));
    this.saving = next.catch(() => {});
    return next;
  }

  private async saveRecord(capture: Capture) {
    await this.prune();
    const safe = captureSchema.parse(capture);
    const all = await this.area.get(null);
    if (
      !all[`${capturePrefix}${safe.id}`] &&
      Object.keys(all).filter((key) => key.startsWith(capturePrefix)).length >= 5
    ) {
      throw new Error('Close an existing TableLyft workspace before capturing another table.');
    }
    await this.area.set({ [`${capturePrefix}${safe.id}`]: safe });
  }

  async remove(id: string) {
    await this.area.remove(`${capturePrefix}${id}`);
  }

  async removeForEditor(tabId: number) {
    const all = await this.area.get(null);
    const keys = Object.entries(all)
      .filter(([key, value]) => {
        if (!key.startsWith(capturePrefix)) return false;
        const parsed = captureSchema.safeParse(value);
        return parsed.success && parsed.data.editorTabId === tabId;
      })
      .map(([key]) => key);
    if (keys.length) await this.area.remove(keys);
  }

  async setPending(tabId: number, pending: PendingCapture) {
    await this.prune();
    await this.area.set({ [`${pendingPrefix}${tabId}`]: pendingSchema.parse(pending) });
  }

  async cancel(tabId: number, token?: string) {
    const key = `${pendingPrefix}${tabId}`;
    if (token) {
      const parsed = pendingSchema.safeParse((await this.area.get(key))[key]);
      if (!parsed.success || parsed.data.token !== token) return;
    }
    await this.area.remove(key);
  }

  async consume(
    tabId: number,
    documentId: string | undefined,
    frameId: number | undefined,
    token: string,
  ): Promise<PendingCapture> {
    const key = `${pendingPrefix}${tabId}`;
    const parsed = pendingSchema.safeParse((await this.area.get(key))[key]);
    if (
      !parsed.success ||
      this.expired(parsed.data.createdAt, REQUEST_TTL) ||
      parsed.data.token !== token ||
      parsed.data.documentId !== documentId ||
      frameId !== 0 ||
      this.claimed.has(token)
    ) {
      throw new Error('Selection access expired. Open TableLyft on the source page again.');
    }
    // Retain the claim until expiry: concurrent storage reads can return the same stale pending value.
    this.claimed.set(token, parsed.data.createdAt + REQUEST_TTL);
    await this.area.remove(key);
    return parsed.data;
  }
}
