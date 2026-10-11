import { afterEach, describe, expect, it, vi } from 'vitest';
import { PartnerSessionTracker } from '../modules/ometv/session';

describe('partner session tracking', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('detects late video mounting, stream replacement and disconnect', () => {
    const changed = vi.fn();
    const tracker = new PartnerSessionTracker(changed);
    tracker.check();
    expect(changed).not.toHaveBeenCalled();
    document.body.innerHTML = '<div id="remote-video-wrapper" class="s-play"><video id="remote-video"></video></div>';
    const video = document.querySelector('video')!;
    video.srcObject = { id: 'a', active: true, getVideoTracks: () => [{ id: 'track-a', readyState: 'live' }] } as unknown as MediaStream;
    tracker.check();
    const first = tracker.current!.id;
    expect(tracker.isCurrent(first)).toBe(true);
    video.srcObject = { id: 'b', active: true, getVideoTracks: () => [{ id: 'track-b', readyState: 'live' }] } as unknown as MediaStream;
    expect(tracker.isCurrent(first)).toBe(false);
    tracker.check();
    expect(tracker.current!.id).not.toBe(first);
    document.querySelector('#remote-video-wrapper')!.classList.remove('s-play');
    tracker.check();
    expect(tracker.current).toBeNull();
    tracker.destroy();
  });

  it('detects rapid class transitions even with a reused stream', async () => {
    document.body.innerHTML = '<div id="remote-video-wrapper" class="s-play"><video id="remote-video"></video></div>';
    const tracker = new PartnerSessionTracker(vi.fn());
    tracker.start();
    const first = tracker.current!.id;
    const wrapper = document.querySelector('#remote-video-wrapper')!;
    wrapper.className = 's-search';
    wrapper.className = 's-play';
    await Promise.resolve();
    expect(tracker.current!.id).not.toBe(first);
    const second = tracker.current!.id;
    wrapper.className = 's-play extra';
    await Promise.resolve();
    expect(tracker.current!.id).toBe(second);
    tracker.destroy();
  });

  it('rejects ended tracks and detects track replacement in a reused MediaStream', () => {
    document.body.innerHTML = '<div id="remote-video-wrapper" class="s-play"><video id="remote-video"></video></div>';
    let track = { id: 'a', readyState: 'live' };
    document.querySelector('video')!.srcObject = { id: 'same', active: true, getVideoTracks: () => [track] } as unknown as MediaStream;
    const tracker = new PartnerSessionTracker(vi.fn());
    tracker.check();
    const first = tracker.current!.id;
    track = { id: 'b', readyState: 'live' };
    expect(tracker.isCurrent(first)).toBe(false);
    tracker.check();
    expect(tracker.current!.id).not.toBe(first);
    track.readyState = 'ended';
    tracker.check();
    expect(tracker.current).toBeNull();
    tracker.destroy();
  });
});
