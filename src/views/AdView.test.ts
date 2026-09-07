import { describe, expect, it, vi } from 'vitest';
import { AdView } from './AdView';

describe('AdView', () => {
  it('shows and hides the ad container', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    vi.spyOn(video, 'pause').mockImplementation(() => {});
    vi.spyOn(video, 'load').mockImplementation(() => {});
    const view = new AdView(container, video);

    view.show();
    expect(container.style.display).toBe('block');

    view.hide();
    expect(container.style.display).toBe('none');
  });

  it('returns the container and video elements it owns', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    const view = new AdView(container, video);

    expect(view.getContainer()).toBe(container);
    expect(view.getVideo()).toBe(video);
  });

  it('can be shown and hidden repeatedly without throwing', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    vi.spyOn(video, 'pause').mockImplementation(() => {
      throw new Error('media unavailable');
    });
    vi.spyOn(video, 'load').mockImplementation(() => {
      throw new Error('media unavailable');
    });
    const view = new AdView(container, video);

    expect(() => {
      view.show();
      view.hide();
      view.hide();
      view.show();
      view.hide();
    }).not.toThrow();
    expect(container.style.display).toBe('none');
  });
});
