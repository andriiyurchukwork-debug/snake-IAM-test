import { AppState } from '../types/AppState';
import { Direction } from '../types/Direction';

export interface InputHandlers {
  onDirection: (direction: Direction) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: Direction.Up,
  ArrowDown: Direction.Down,
  ArrowLeft: Direction.Left,
  ArrowRight: Direction.Right,
};

export class InputController {
  private readonly handleKeydownBound = this.handleKeydown.bind(this);

  constructor(
    private readonly getState: () => AppState,
    private readonly handlers: InputHandlers,
  ) {
    window.addEventListener('keydown', this.handleKeydownBound);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeydownBound);
  }

  private handleKeydown(event: KeyboardEvent): void {
    const state = this.getState();

    if (state === AppState.Playing && KEY_TO_DIRECTION[event.key]) {
      event.preventDefault();
      this.handlers.onDirection(KEY_TO_DIRECTION[event.key]);
      return;
    }

    if (state === AppState.PromptPlay || state === AppState.PromptReplay) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.handlers.onConfirm();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.handlers.onCancel();
      }
    }
  }
}
