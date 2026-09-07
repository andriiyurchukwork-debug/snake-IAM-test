export class AdView {
  constructor(
    private readonly container: HTMLElement,
    private readonly video: HTMLVideoElement,
  ) {}

  getContainer(): HTMLElement {
    return this.container;
  }

  getVideo(): HTMLVideoElement {
    return this.video;
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
    try {
      this.video.pause();
    } catch {
      // Hiding the view must remain safe when media playback is unavailable.
    }
    this.video.removeAttribute('src');
    try {
      this.video.load();
    } catch {
      // Hiding the view must remain safe when media loading is unavailable.
    }
  }

  destroy(): void {
    this.hide();
  }
}
