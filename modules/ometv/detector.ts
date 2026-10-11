import { OMETV_SELECTORS, MALE_IDENTIFIERS, FEMALE_IDENTIFIERS } from './constants';
import type { GenderType, PartnerDetectedEvent } from '../types';

export class OmePartnerDetector {
  private observer: MutationObserver | null = null;
  private onPartnerCallback: ((event: PartnerDetectedEvent) => void) | null = null;
  private lastDetectedTimestamp = 0;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  public start(callback: (event: PartnerDetectedEvent) => void) {
    this.onPartnerCallback = callback;

    // 1. Listen for WebSocket messages forwarded from main-world interceptor
    this.messageListener = (event: MessageEvent) => {
      if (event.data?.source === 'WINGMAN_INJECTED' && event.data?.type === 'PARTNER_DATA') {
        const payload = event.data.payload;
        this.emitDetection({
          gender: payload.gender,
          country: payload.country,
          source: 'websocket',
          raw: payload
        });
      }
    };
    window.addEventListener('message', this.messageListener);

    // 2. Set up DOM MutationObserver as a robust fallback/complement
    this.startDomObserver();
  }

  public stop() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.onPartnerCallback = null;
  }

  private startDomObserver() {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          this.checkDomForPartner();
        }
      }
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  public checkDomForPartner() {
    // Check elements matching partner details or gender badges
    for (const selector of OMETV_SELECTORS.partnerDetails) {
      const elements = document.querySelectorAll(selector);
      for (const el of Array.from(elements)) {
        const detected = this.extractGenderFromElement(el);
        if (detected !== 'unknown') {
          this.emitDetection({
            gender: detected,
            source: 'dom'
          });
          return;
        }
      }
    }

    // Check specific gender icon selectors
    for (const selector of OMETV_SELECTORS.genderIcons) {
      const icons = document.querySelectorAll(selector);
      for (const icon of Array.from(icons)) {
        const detected = this.extractGenderFromElement(icon);
        if (detected !== 'unknown') {
          this.emitDetection({
            gender: detected,
            source: 'dom'
          });
          return;
        }
      }
    }
  }

  private extractGenderFromElement(element: Element): GenderType {
    const text = (element.textContent || '').toLowerCase();
    const className = (element.className || '').toString().toLowerCase();
    const title = (element.getAttribute('title') || '').toLowerCase();
    const aria = (element.getAttribute('aria-label') || '').toLowerCase();
    const dataGender = (element.getAttribute('data-gender') || '').toLowerCase();

    const combined = `${text} ${className} ${title} ${aria} ${dataGender}`;

    for (const male of MALE_IDENTIFIERS) {
      if (new RegExp(`\\b${male}\\b|${male}`, 'i').test(combined)) {
        return 'male';
      }
    }

    for (const female of FEMALE_IDENTIFIERS) {
      if (new RegExp(`\\b${female}\\b|${female}`, 'i').test(combined)) {
        return 'female';
      }
    }

    return 'unknown';
  }

  private emitDetection(event: PartnerDetectedEvent) {
    const now = Date.now();
    // Debounce detections within 1000ms to avoid re-triggering for the same partner
    if (now - this.lastDetectedTimestamp < 1000 && event.source === 'dom') {
      return;
    }
    this.lastDetectedTimestamp = now;

    if (this.onPartnerCallback) {
      this.onPartnerCallback(event);
    }
  }
}
