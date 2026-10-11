import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../modules/preferences';

const mocks = vi.hoisted(() => ({ infer: vi.fn(), tiny: vi.fn(async () => {}), gender: vi.fn(async () => {}) }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { getURL: () => 'chrome-extension://test/' } } }));
vi.mock('@vladmandic/face-api', () => ({
  nets: { tinyFaceDetector: { loadFromUri: mocks.tiny }, ageGenderNet: { loadFromUri: mocks.gender } },
  TinyFaceDetectorOptions: class {},
  detectAllFaces: () => ({ withAgeAndGender: mocks.infer }),
}));
import { OmeAiVisionDetector } from '../modules/ometv/vision';

function session(id = 1) {
  const video = document.createElement('video');
  Object.defineProperties(video, { paused: { value: false }, readyState: { value: 4 },
    videoWidth: { value: 640 }, videoHeight: { value: 480 } });
  return { id, video, fingerprint: String(id) };
}
const face = { gender: 'female', genderProbability: 0.95 };

describe('vision scheduling', () => {
  beforeEach(() => { vi.useFakeTimers(); mocks.infer.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('requires repeated single-face readings and treats multiple faces as uncertain', async () => {
    const vision = new OmeAiVisionDetector();
    const event = vi.fn();
    mocks.infer.mockResolvedValueOnce([face, face]).mockResolvedValue([face]);
    vision.start(session(), DEFAULT_SETTINGS, () => true, event, vi.fn());
    await vi.advanceTimersByTimeAsync(700);
    expect(event).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(event).toHaveBeenCalledWith({ sessionId: 1, gender: 'female', confidence: 0.95 });
    vision.destroy();
  });

  it('never overlaps inference or delivers a stale frame after a connection change', async () => {
    const vision = new OmeAiVisionDetector();
    const event = vi.fn();
    let resolve!: (value: unknown) => void;
    mocks.infer.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue([face]);
    vision.start(session(), DEFAULT_SETTINGS, () => true, event, vi.fn());
    vision.start(session(2), DEFAULT_SETTINGS, () => true, event, vi.fn());
    await vi.advanceTimersByTimeAsync(1400);
    expect(mocks.infer).toHaveBeenCalledTimes(1);
    resolve([face]);
    await vi.advanceTimersByTimeAsync(1400);
    expect(event).toHaveBeenCalledTimes(1);
    expect(event.mock.calls[0]![0].sessionId).toBe(2);
    vision.destroy();
  });

  it('emits unknown for no face, never a fabricated male classification', async () => {
    const vision = new OmeAiVisionDetector();
    const event = vi.fn();
    mocks.infer.mockResolvedValue([]);
    vision.start(session(), { ...DEFAULT_SETTINGS, unknownTimeoutMs: 3000 }, () => true, event, vi.fn());
    await vi.advanceTimersByTimeAsync(3500);
    expect(event).toHaveBeenCalledWith({ sessionId: 1, gender: 'unknown', reason: 'timeout' });
    vision.destroy();
  });

  it('reports repeated inference failures instead of classifying them', async () => {
    const vision = new OmeAiVisionDetector();
    const event = vi.fn();
    const error = vi.fn();
    mocks.infer.mockRejectedValue(new Error('WebGL error'));
    vision.start(session(), DEFAULT_SETTINGS, () => true, event, error);
    await vi.advanceTimersByTimeAsync(5000);
    expect(error).toHaveBeenCalledTimes(1);
    expect(event).not.toHaveBeenCalled();
    vision.destroy();
  });
});
