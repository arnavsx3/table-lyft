import * as faceapi from '@vladmandic/face-api';
import { browser } from 'wxt/browser';
import { DetectionConsensus } from './decision';
import type { PartnerSession } from './session';
import type { PartnerDetectedEvent, WingmanSettings } from '../types';

export class OmeAiVisionDetector {
  private loadPromise: Promise<void> | null = null;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;

  public load(): Promise<void> {
    if (!this.loadPromise) {
      const uri = new URL('models', browser.runtime.getURL('/')).href;
      this.loadPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(uri),
        faceapi.nets.ageGenderNet.loadFromUri(uri),
      ]).then(() => undefined).catch(error => {
        this.loadPromise = null;
        throw error;
      });
    }
    return this.loadPromise;
  }

  public start(session: PartnerSession, settings: WingmanSettings,
    isCurrent: () => boolean, onPartner: (event: PartnerDetectedEvent) => void, onError: () => void) {
    this.stop();
    const generation = this.generation;
    const consensus = new DetectionConsensus();
    let deadline = Date.now() + settings.unknownTimeoutMs;
    let failures = 0;
    const valid = () => generation === this.generation && isCurrent();
    const schedule = () => { if (valid()) this.timer = setTimeout(() => { void scan(); }, 350); };
    const scan = async () => {
      if (!valid()) return;
      if (document.hidden) {
        deadline = Date.now() + settings.unknownTimeoutMs;
        consensus.reset();
        schedule();
        return;
      }
      if (this.busy) { schedule(); return; }
      if (Date.now() >= deadline) {
        onPartner({ sessionId: session.id, gender: 'unknown', reason: 'timeout' });
        return;
      }
      const video = session.video;
      if (video.paused || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        consensus.reset();
        schedule();
        return;
      }
      this.busy = true;
      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const results = await faceapi.detectAllFaces(video, options).withAgeAndGender();
        if (!valid()) return;
        failures = 0;
        // Multiple faces are ambiguous; never select an arbitrary person to skip.
        const result = results.length === 1 ? results[0] : null;
        const gender = consensus.add(result?.gender === 'male' ? 'male' : result?.gender === 'female' ? 'female' : 'unknown',
          result?.genderProbability ?? 0, settings.minimumConfidence);
        if (gender) {
          onPartner({ sessionId: session.id, gender, confidence: result!.genderProbability });
          return;
        }
      } catch {
        if (!valid()) return;
        consensus.reset();
        if (++failures >= 3) { onError(); return; }
      } finally {
        this.busy = false;
      }
      schedule();
    };
    void scan();
  }

  public stop() {
    this.generation++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  public destroy() { this.stop(); }
}
