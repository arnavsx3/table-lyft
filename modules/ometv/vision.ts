import * as faceapi from '@vladmandic/face-api';
import type { PartnerDetectedEvent } from '../types';

export class OmeAiVisionDetector {
  private isModelLoaded = false;
  private isScanning = false;
  private scanInterval: number | null = null;
  private onPartnerCallback: ((event: PartnerDetectedEvent) => void) | null = null;
  
  // Track partner stream sessions to prevent duplicate counting
  private activeStreamId: string | null = null;
  private isCurrentPartnerHandled = false;
  private sessionCounter = 0;

  public async init(onPartner: (event: PartnerDetectedEvent) => void) {
    this.onPartnerCallback = onPartner;

    try {
      console.log('[Wingman AI] Loading face & gender models...');
      const modelUri = chrome.runtime.getURL('models');
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelUri);
      await faceapi.nets.ageGenderNet.loadFromUri(modelUri);
      this.isModelLoaded = true;
      console.log('[Wingman AI] Vision models loaded successfully!');
      this.watchVideoPlayback();
    } catch (err) {
      console.error('[Wingman AI] Failed to load vision models:', err);
    }
  }

  private watchVideoPlayback() {
    const checkState = () => {
      const wrapper = document.querySelector('#remote-video-wrapper');
      const isPlaying = wrapper?.classList.contains('s-play');
      const video = document.querySelector('#remote-video') as HTMLVideoElement | null;

      if (!isPlaying || !video) {
        // When video stops or searches, reset current partner session
        if (this.activeStreamId !== null || this.isScanning) {
          this.activeStreamId = null;
          this.isCurrentPartnerHandled = false;
          this.stopScanning();
        }
        return;
      }

      // Detect stream change: either new MediaStream ID or new video dimensions
      const stream = video.srcObject as MediaStream | null;
      const streamId = stream ? stream.id : `stream_${this.sessionCounter}`;

      if (streamId !== this.activeStreamId) {
        // Brand new stranger connected!
        this.activeStreamId = streamId;
        this.isCurrentPartnerHandled = false;
        this.sessionCounter++;
        console.log(`[Wingman AI] New partner stream detected (Session #${this.sessionCounter})`);
        this.startScanning(video);
      } else if (!this.isCurrentPartnerHandled && !this.isScanning && !video.paused) {
        // Still needs evaluation
        this.startScanning(video);
      }
    };

    // Watch DOM mutations on the remote video wrapper
    const observer = new MutationObserver(checkState);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'src'] });

    // Polling fallback
    window.setInterval(checkState, 250);
  }

  private startScanning(video: HTMLVideoElement) {
    if (!this.isModelLoaded || this.isScanning || this.isCurrentPartnerHandled) return;
    this.isScanning = true;

    let attempts = 0;
    const maxAttempts = 9; // ~2.7 seconds max before anti-hang auto-skip

    this.scanInterval = window.setInterval(async () => {
      attempts++;

      // If partner is already handled or video paused, stop
      if (!this.isScanning || this.isCurrentPartnerHandled || !video || video.paused) {
        this.stopScanning();
        return;
      }

      // If stranger hasn't turned on camera or face not found after 2.7s: prevent hanging!
      if (attempts >= maxAttempts) {
        console.log('[Wingman AI] No clear face detected after 2.7s (uncammed or obscured). Anti-hang auto-skipping...');
        this.isCurrentPartnerHandled = true;
        this.stopScanning();
        this.onPartnerCallback?.({
          gender: 'male', // Treat uncammed/blank screens as skip target
          source: 'dom',
          raw: { reason: 'no_face_timeout' }
        });
        return;
      }

      // Wait until video has valid frames
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
        const result = await faceapi.detectSingleFace(video, options).withAgeAndGender();

        if (result && this.isScanning && !this.isCurrentPartnerHandled) {
          const gender = result.gender; // 'male' | 'female'
          const probability = Math.round(result.genderProbability * 100);
          console.log(`[Wingman AI] Face detected: ${gender.toUpperCase()} (${probability}% confidence, Age: ~${Math.round(result.age)})`);

          if (result.genderProbability >= 0.55) {
            // Lock this partner as handled so it is NEVER double-evaluated or double-counted!
            this.isCurrentPartnerHandled = true;
            this.stopScanning();

            this.onPartnerCallback?.({
              gender: gender === 'male' ? 'male' : 'female',
              source: 'dom',
              raw: { probability, age: result.age }
            });
          }
        }
      } catch (e) {
        // Frame processing glitch ignored
      }
    }, 280);
  }

  public notifyPartnerSkippedManually() {
    this.isCurrentPartnerHandled = true;
    this.stopScanning();
  }

  private stopScanning() {
    this.isScanning = false;
    if (this.scanInterval !== null) {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  public destroy() {
    this.stopScanning();
    this.onPartnerCallback = null;
  }
}
