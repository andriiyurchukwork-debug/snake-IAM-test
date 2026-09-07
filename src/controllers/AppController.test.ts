import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './AppController';
import { AppState } from '../types/AppState';
import { Direction } from '../types/Direction';
import { TICK_MS } from '../config/gameConfig';
import { SnakeGameModel, type GameSnapshot } from '../models/SnakeGameModel';

const snapshot: GameSnapshot = {
  snake: [{ x: 1, y: 1 }],
  food: { x: 2, y: 2 },
  score: 0,
};

describe('AppController', () => {
  let gameView: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn> };
  let promptView: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };
  let adView: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
  let adModel: {
    requestAd: ReturnType<typeof vi.fn>;
    onComplete: () => void;
    onError: (error: unknown) => void;
    destroy: ReturnType<typeof vi.fn>;
  };
  let redirect: ReturnType<typeof vi.fn>;
  let controller: AppController | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    gameView = { show: vi.fn(), hide: vi.fn(), render: vi.fn() };
    promptView = { show: vi.fn(), hide: vi.fn() };
    adView = { show: vi.fn(), hide: vi.fn(), destroy: vi.fn() };
    adModel = { requestAd: vi.fn(), onComplete: () => {}, onError: () => {}, destroy: vi.fn() };
    redirect = vi.fn();
  });

  afterEach(() => {
    controller?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with the play prompt without requesting an ad', () => {
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();

    expect(controller.getState()).toBe(AppState.PromptPlay);
    expect(adView.show).not.toHaveBeenCalled();
    expect(adModel.requestAd).not.toHaveBeenCalled();
    expect(gameView.hide).toHaveBeenCalled();
    expect(promptView.show).toHaveBeenCalledWith('Do you want to play?');
  });

  it('requests the pre-roll ad only after Enter on the initial prompt', () => {
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));

    expect(controller.getState()).toBe(AppState.PreRollAd);
    expect(adView.show).toHaveBeenCalledOnce();
    expect(adModel.requestAd).toHaveBeenCalledOnce();
    expect(gameView.hide).toHaveBeenCalled();
    expect(promptView.hide).toHaveBeenCalled();
  });

  it('hides ads before showing the play prompt and shows them for post-roll', () => {
    vi.spyOn(SnakeGameModel.prototype, 'tick').mockImplementation(() => {});
    vi.spyOn(SnakeGameModel.prototype, 'isGameOver', 'get').mockReturnValue(true);
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    expect(adView.hide).toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    vi.advanceTimersByTime(TICK_MS);

    expect(controller.getState()).toBe(AppState.PostRollAd);
    expect(adView.show).toHaveBeenCalledTimes(2);
    adModel.onComplete();
    expect(adView.hide).toHaveBeenCalledTimes(4);
  });

  it('confirms play, resets the model, and renders the initial board', () => {
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    expect(controller.getState()).toBe(AppState.PromptPlay);
    expect(promptView.show).toHaveBeenLastCalledWith('Do you want to play?');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));

    expect(controller.getState()).toBe(AppState.Playing);
    expect(promptView.hide).toHaveBeenCalled();
    expect(gameView.show).toHaveBeenCalled();
    expect(gameView.render).toHaveBeenCalledWith(
      expect.objectContaining({ score: 0, snake: expect.any(Array) }),
    );
  });

  it('routes arrow keys to the game while playing', () => {
    controller = new AppController(gameView, promptView, redirect, adView, adModel);
    const setDirection = vi.spyOn(SnakeGameModel.prototype, 'setDirection');

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

    expect(setDirection).toHaveBeenCalledWith(Direction.Up);
  });

  it('ticks on the configured interval and stops when the game ends', () => {
    let gameOver = false;
    vi.spyOn(SnakeGameModel.prototype, 'tick').mockImplementation(() => {
      gameOver = true;
    });
    vi.spyOn(SnakeGameModel.prototype, 'getSnapshot').mockReturnValue(snapshot);
    vi.spyOn(SnakeGameModel.prototype, 'isGameOver', 'get').mockImplementation(() => gameOver);

    controller = new AppController(gameView, promptView, redirect, adView, adModel);
    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    vi.advanceTimersByTime(TICK_MS);
    expect(controller.getState()).toBe(AppState.PostRollAd);
    adModel.onComplete();
    expect(controller.getState()).toBe(AppState.PromptReplay);
    expect(promptView.show).toHaveBeenCalledWith('Do you want to play again?');

    const renderCount = gameView.render.mock.calls.length;
    vi.advanceTimersByTime(TICK_MS * 2);
    expect(gameView.render).toHaveBeenCalledTimes(renderCount);
  });

  it('confirms replay, runs one pre-roll, and starts directly without a second prompt', () => {
    const reset = vi.spyOn(SnakeGameModel.prototype, 'reset');
    vi.spyOn(SnakeGameModel.prototype, 'tick').mockImplementation(() => {});
    vi.spyOn(SnakeGameModel.prototype, 'isGameOver', 'get').mockReturnValue(true);

    controller = new AppController(gameView, promptView, redirect, adView, adModel);
    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    vi.advanceTimersByTime(TICK_MS);

    expect(controller.getState()).toBe(AppState.PostRollAd);
    adModel.onComplete();
    expect(controller.getState()).toBe(AppState.PromptReplay);
    const resetCountBeforeReplay = reset.mock.calls.length;
    const promptCountBeforeReplay = promptView.show.mock.calls.length;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(controller.getState()).toBe(AppState.PreRollAd);
    expect(adModel.requestAd).toHaveBeenCalledTimes(3);
    adModel.onComplete();

    expect(controller.getState()).toBe(AppState.Playing);
    expect(adModel.requestAd).toHaveBeenCalledTimes(3);
    expect(promptView.show).toHaveBeenCalledTimes(promptCountBeforeReplay);
    expect(reset).toHaveBeenCalledTimes(resetCountBeforeReplay + 1);
    expect(promptView.hide).toHaveBeenCalled();
    expect(gameView.show).toHaveBeenCalled();
    expect(gameView.render).toHaveBeenLastCalledWith(
      expect.objectContaining({ score: 0, snake: expect.any(Array) }),
    );
  });

  it('redirects when Escape is pressed on the replay prompt', () => {
    vi.spyOn(SnakeGameModel.prototype, 'tick').mockImplementation(() => {});
    vi.spyOn(SnakeGameModel.prototype, 'isGameOver', 'get').mockReturnValue(true);

    controller = new AppController(gameView, promptView, redirect, adView, adModel);
    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    vi.advanceTimersByTime(TICK_MS);

    expect(controller.getState()).toBe(AppState.PostRollAd);
    adModel.onComplete();
    expect(controller.getState()).toBe(AppState.PromptReplay);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(controller.getState()).toBe(AppState.Redirect);
    expect(redirect).toHaveBeenCalledWith('https://www.google.com');
  });

  it('redirects when Escape is pressed on either prompt', () => {
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(controller.getState()).toBe(AppState.Redirect);
    expect(redirect).toHaveBeenCalledWith('https://www.google.com');
  });

  it('advances from an ad error through the error fallback', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onError(new Error('ad failed'));

    expect(controller.getState()).toBe(AppState.PromptPlay);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('auto-completes when constructed without ad dependencies', async () => {
    controller = new AppController(gameView, promptView, redirect);

    controller.start();
    await Promise.resolve();

    expect(controller.getState()).toBe(AppState.PromptPlay);
  });

  it('keeps fallback ad callbacks isolated between controller instances', async () => {
    const firstController = new AppController(gameView, promptView, redirect);
    const secondGameView = { show: vi.fn(), hide: vi.fn(), render: vi.fn() };
    const secondPromptView = { show: vi.fn(), hide: vi.fn() };
    const secondController = new AppController(secondGameView, secondPromptView, redirect);

    firstController.start();
    secondController.start();
    await Promise.resolve();

    expect(firstController.getState()).toBe(AppState.PromptPlay);
    expect(secondController.getState()).toBe(AppState.PromptPlay);

    firstController.destroy();
    secondController.destroy();
    controller = undefined;
  });

  it('destroy stops the game loop, removes keyboard effects, and cleans up ads', () => {
    const tick = vi.spyOn(SnakeGameModel.prototype, 'tick').mockImplementation(() => {});
    const setDirection = vi.spyOn(SnakeGameModel.prototype, 'setDirection');
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    adModel.onComplete();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    vi.advanceTimersByTime(TICK_MS);
    expect(tick).toHaveBeenCalled();
    const tickCountBeforeDestroy = tick.mock.calls.length;

    controller.destroy();
    controller = undefined;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    vi.advanceTimersByTime(TICK_MS * 2);

    expect(tick).toHaveBeenCalledTimes(tickCountBeforeDestroy);
    expect(setDirection).not.toHaveBeenCalled();
    expect(adModel.destroy).toHaveBeenCalledOnce();
    expect(adView.destroy).toHaveBeenCalledOnce();
  });

  it('ignores duplicate ad completions and cleans up all dependencies', () => {
    controller = new AppController(gameView, promptView, redirect, adView, adModel);

    controller.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const completion = adModel.onComplete;
    completion();
    completion();

    expect(controller.getState()).toBe(AppState.PromptPlay);
    expect(adModel.requestAd).toHaveBeenCalledOnce();

    controller.destroy();

    expect(adModel.destroy).toHaveBeenCalledOnce();
    expect(adView.destroy).toHaveBeenCalledOnce();
  });
});
