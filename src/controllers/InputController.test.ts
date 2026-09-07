import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputController, type InputHandlers } from './InputController';
import { AppState } from '../types/AppState';
import { Direction } from '../types/Direction';

describe('InputController', () => {
  let state: AppState;
  let handlers: InputHandlers;
  let controller: InputController;

  beforeEach(() => {
    state = AppState.Boot;
    handlers = {
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
      onDirection: vi.fn(),
    };
    controller = new InputController(() => state, handlers);
  });

  afterEach(() => {
    controller.destroy();
  });

  it.each([
    ['ArrowUp', Direction.Up],
    ['ArrowDown', Direction.Down],
    ['ArrowLeft', Direction.Left],
    ['ArrowRight', Direction.Right],
  ])('routes %s to direction while playing', (key, direction) => {
    state = AppState.Playing;
    const event = new KeyboardEvent('keydown', { key, cancelable: true });

    window.dispatchEvent(event);

    expect(handlers.onDirection).toHaveBeenCalledWith(direction);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['Enter', 'onConfirm'],
    ['Escape', 'onCancel'],
  ])('routes %s to prompt action during prompt states', (key, handler) => {
    for (const promptState of [AppState.PromptPlay, AppState.PromptReplay]) {
      state = promptState;
      const event = new KeyboardEvent('keydown', { key, cancelable: true });

      window.dispatchEvent(event);

      expect(handlers[handler as keyof InputHandlers]).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
      vi.clearAllMocks();
    }
  });

  it('ignores unmapped keys and keys in non-handling states', () => {
    const keysAndStates = [
      ['Space', AppState.Playing],
      ['ArrowUp', AppState.Boot],
      ['Enter', AppState.Playing],
      ['Escape', AppState.GameOver],
    ] as const;

    for (const [key, currentState] of keysAndStates) {
      state = currentState;
      const event = new KeyboardEvent('keydown', { key, cancelable: true });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    }

    expect(handlers.onDirection).not.toHaveBeenCalled();
    expect(handlers.onConfirm).not.toHaveBeenCalled();
    expect(handlers.onCancel).not.toHaveBeenCalled();
  });

  it('stops handling keys after destroy', () => {
    state = AppState.Playing;
    controller.destroy();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(handlers.onDirection).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
