export class PromptView {
  constructor(
    private readonly overlay: HTMLElement,
    private readonly textElement: HTMLElement,
  ) {}

  show(message: string): void {
    this.textElement.textContent = message;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }
}
