import * as faceapi from '@vladmandic/face-api';
import type { PartnerDetectedEvent } from '../types';

export class OmeAiVisionDetector {
  private isModelLoaded = false;
  private isScanning = false;
  private scanInterval: number | null = null;
  private onPartnerCallback: ((event: PartnerDetectedEvent) => void) | null = null;
  private lastDetectedPartnerId: string | null = null;

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

      if (isPlaying && video && !video.paused && !this.isScanning) {
        this.startScanning(video);
      } else if (!isPlaying && this.isScanning) {
        this.stopScanning();
      }
    };

    // Watch DOM mutations on the remote video wrapper
    const observer = new MutationObserver(checkState);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

    // Also poll every 400ms as fallback
    window.setInterval(checkState, 400);
  }

  private startScanning(video: HTMLVideoElement) {
    if (!this.isModelLoaded || this.isScanning) return;
    this.isScanning = true;
    console.log('[Wingman AI] Stranger connected! Starting real-time face scan...');

    let attempts = 0;
    const maxAttempts = 12; // ~3.6 seconds total

    this.scanInterval = window.setInterval(async () => {
      attempts++;

      if (!this.isScanning || !video || video.paused || attempts > maxAttempts) {
        this.stopScanning();
        return;
      }

      // Ensure video has actual frames
      if (video.readyState < 2 || video.videoWidth === 0) {
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const result = await faceapi.detectSingleFace(video, options).withAgeAndGender();

        if (result && this.isScanning) {
          const gender = result.gender; // 'male' | 'female'
          const probability = Math.round(result.genderProbability * 100);
          console.log(`[Wingman AI] Detected: ${gender.toUpperCase()} (${probability}% confidence, Age: ~${Math.round(result.age)})`);

          if (result.genderProbability >= 0.60) {
            this.stopScanning();
            this.onPartnerCallback?.({
              gender: gender === 'male' ? 'male' : 'female',
              source: 'dom',
              raw: { probability, age: result.age }
            });
          }
        }
      } catch (e) {
        // Ignore single frame error
      }
    }, 300);
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
