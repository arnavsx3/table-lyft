export interface PartnerSession {
  id: number;
  video: HTMLVideoElement;
  fingerprint: string;
}

export class PartnerSessionTracker {
  public current: PartnerSession | null = null;
  private counter = 0;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wrapper: Element | null = null;

  constructor(private onChange: (session: PartnerSession | null) => void) {}

  private snapshot() {
    const wrapper = document.querySelector('#remote-video-wrapper');
    const video = document.querySelector<HTMLVideoElement>('#remote-video');
    if (!wrapper || !video || wrapper.matches('.s-stop, .s-search')) return null;
    const stream = video.srcObject;
    const media = stream && 'getVideoTracks' in stream ? stream as MediaStream : null;
    const tracks = media?.getVideoTracks() ?? [];
    if (media && (!media.active || tracks.length === 0 || tracks.every(track => track.readyState === 'ended'))) return null;
    const playing = !video.paused && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    if (!wrapper.classList.contains('s-play') && !(media && playing)) return null;
    if (!media && !(playing && (video.currentSrc || video.src))) return null;
    return { video, fingerprint: media ? `${media.id}:${tracks.map(track => track.id).join(',')}` : video.currentSrc || video.src };
  }

  public start() {
    this.observer = new MutationObserver(records => {
      // A complete disconnect/reconnect can happen between two polling ticks.
      const transitions = records.filter(record => record.target === this.wrapper && record.attributeName === 'class');
      if (this.current && transitions.some(record => /(?:^|\s)s-(?:stop|search)(?:\s|$)/.test(record.oldValue ?? ''))) this.invalidate();
      this.check();
    });
    this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'src'] });
    this.timer = setInterval(() => this.check(), 200);
    this.check();
  }

  public check() {
    this.wrapper = document.querySelector('#remote-video-wrapper');
    const next = this.snapshot();
    if (this.current && (!next || next.video !== this.current.video || next.fingerprint !== this.current.fingerprint)) this.invalidate();
    if (!this.current && next) {
      this.current = { ...next, id: ++this.counter };
      this.onChange(this.current);
    }
  }

  public isCurrent(id: number): boolean {
    const next = this.snapshot();
    return this.current?.id === id && !!next && next.video === this.current.video && next.fingerprint === this.current.fingerprint;
  }

  private invalidate() {
    if (!this.current) return;
    this.current = null;
    this.onChange(null);
  }

  public destroy() {
    this.observer?.disconnect();
    if (this.timer !== null) clearInterval(this.timer);
    this.invalidate();
  }
}
