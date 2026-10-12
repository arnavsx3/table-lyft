import { describe, expect, it } from 'vitest';
import { sampleTable } from '../src/core/sample';
import { CAPTURE_TTL, type Capture, messageSchema, REQUEST_TTL } from '../src/core/schema';
import {
  CaptureRepository,
  type PendingCapture,
  type SessionArea,
} from '../src/extension/repository';

class MemoryArea implements SessionArea {
  data: Record<string, unknown> = {};
  async get(keys?: string | string[] | null) {
    const result = keys
      ? Object.fromEntries(
          (typeof keys === 'string' ? [keys] : keys).map((key) => [key, this.data[key]]),
        )
      : this.data;
    return structuredClone(result);
  }
  async set(items: Record<string, unknown>) {
    Object.assign(this.data, structuredClone(items));
  }
  async remove(keys: string | string[]) {
    for (const key of typeof keys === 'string' ? [keys] : keys) delete this.data[key];
  }
}

const now = 10000000;
const source = { title: 'Source', url: 'https://example.com/data', tabId: 7 };
const pending: PendingCapture = {
  token: crypto.randomUUID(),
  documentId: 'doc-1',
  source,
  createdAt: now,
};
const capture: Capture = {
  id: crypto.randomUUID(),
  createdAt: now,
  source,
  table: sampleTable,
  editorTabId: 12,
};

describe('temporary capture repository', () => {
  it('round-trips a validated capture and discards it', async () => {
    const repo = new CaptureRepository(new MemoryArea(), () => now);
    await repo.save(capture);
    expect(await repo.load(capture.id)).toEqual(capture);
    await repo.remove(capture.id);
    expect(await repo.load(capture.id)).toBeNull();
  });
  it('cleans up expired/invalid records without touching unrelated storage', async () => {
    const area = new MemoryArea();
    const repo = new CaptureRepository(area, () => now);
    await repo.save(capture);
    await repo.setPending(7, pending);
    area.data.unrelated = 'retained';
    area.data['tablelyft:capture:invalid'] = 'invalid';
    const later = new CaptureRepository(area, () => now + CAPTURE_TTL);
    expect(await later.load(capture.id)).toBeNull();
    expect(area.data).toEqual({ unrelated: 'retained' });
  });
  it('consumes a matching document-bound token exactly once', async () => {
    const repo = new CaptureRepository(new MemoryArea(), () => now);
    await repo.setPending(7, pending);
    expect(await repo.consume(7, 'doc-1', 0, pending.token)).toEqual(pending);
    await expect(repo.consume(7, 'doc-1', 0, pending.token)).rejects.toThrow(/expired/);
  });
  it.each([
    [8, 'doc-1', 0],
    [7, 'doc-2', 0],
    [7, 'doc-1', 1],
    [7, undefined, 0],
  ] as const)(
    'rejects mismatched tab/document/frame %j %j %j',
    async (tabId, documentId, frameId) => {
      const repo = new CaptureRepository(new MemoryArea(), () => now);
      await repo.setPending(7, pending);
      await expect(repo.consume(tabId, documentId, frameId, pending.token)).rejects.toThrow(
        /expired/,
      );
    },
  );
  it('rejects a forged or expired token', async () => {
    const area = new MemoryArea();
    const repo = new CaptureRepository(area, () => now);
    await repo.setPending(7, pending);
    await expect(repo.consume(7, 'doc-1', 0, crypto.randomUUID())).rejects.toThrow(/expired/);
    await expect(
      new CaptureRepository(area, () => now + REQUEST_TTL).consume(7, 'doc-1', 0, pending.token),
    ).rejects.toThrow(/expired/);
  });
  it('rejects concurrent duplicate submissions', async () => {
    const repo = new CaptureRepository(new MemoryArea(), () => now);
    await repo.setPending(7, pending);
    const replies = await Promise.allSettled([
      repo.consume(7, 'doc-1', 0, pending.token),
      repo.consume(7, 'doc-1', 0, pending.token),
    ]);
    expect(replies.filter((reply) => reply.status === 'fulfilled')).toHaveLength(1);
  });
  it('does not let a stale cancel revoke a newer selection', async () => {
    const repo = new CaptureRepository(new MemoryArea(), () => now);
    await repo.setPending(7, pending);
    await repo.cancel(7, crypto.randomUUID());
    expect(await repo.consume(7, 'doc-1', 0, pending.token)).toEqual(pending);
  });
  it('removes the capture when its editor closes', async () => {
    const repo = new CaptureRepository(new MemoryArea(), () => now);
    await repo.save(capture);
    await repo.removeForEditor(99);
    expect(await repo.load(capture.id)).not.toBeNull();
    await repo.removeForEditor(12);
    expect(await repo.load(capture.id)).toBeNull();
  });
  it('limits concurrent capture count but permits updating an existing record', async () => {
    const repo = new CaptureRepository(new MemoryArea(), () => now);
    for (let i = 0; i < 5; i++) await repo.save({ ...capture, id: crypto.randomUUID() });
    await expect(repo.save(capture)).rejects.toThrow(/Close/);
  });
  it('rejects unknown message commands and unbounded table payloads', () => {
    expect(messageSchema.safeParse({ type: 'upload', url: 'https://example.com' }).success).toBe(
      false,
    );
    expect(messageSchema.safeParse({ type: 'sample:open', extra: 'unexpected' }).success).toBe(
      false,
    );
    expect(
      messageSchema.safeParse({
        type: 'table:capture',
        token: pending.token,
        table: { ...sampleTable, rows: [['x'.repeat(20001)]] },
      }).success,
    ).toBe(false);
  });
});
