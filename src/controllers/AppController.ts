import { TICK_MS } from '../config/gameConfig';
import { REDIRECT_URL } from '../config/appConfig';
import { SnakeGameModel } from '../models/SnakeGameModel';
import { AppState } from '../types/AppState';
import { GameView } from '../views/GameView';
import { PromptView } from '../views/PromptView';
import { AdView } from '../views/AdView';
import { AdModel } from '../models/AdModel';
import { InputController } from './InputController';
import type { Direction } from '../types/Direction';

type GameViewPort = Pick<GameView, 'show' | 'hide' | 'render'>;
type PromptViewPort = Pick<PromptView, 'show' | 'hide'>;
type AdViewPort = Pick<AdView, 'show' | 'hide'> & Partial<Pick<AdView, 'destroy'>>;
type AdModelPort = Pick<AdModel, 'requestAd' | 'destroy'> & {
  onComplete: () => void;
  onError: (error: unknown) => void;
};
type PreRollContext = 'initial' | 'replay';

const NOOP_AD_VIEW: AdViewPort = { show: () => {}, hide: () => {} };

function createNoopAdModel(): AdModelPort {
  const model: AdModelPort = {
    requestAd: () => queueMicrotask(() => model.onComplete()),
    destroy: () => {},
    onComplete: () => {},
    onError: () => {},
  };
  return model;
}

export class AppController {
  private state = AppState.Boot;
  private readonly game = new SnakeGameModel();
  private readonly input: InputController;
  private tickId: number | null = null;
  private adGeneration = 0;
  private preRollCompleted = false;
  private preRollContext: PreRollContext = 'initial';

  constructor(
    private readonly gameView: GameViewPort,
    private readonly promptView: PromptViewPort,
    private readonly redirect: (url: string) => void = (url) => {
      window.location.href = url;
    },
    private readonly adView: AdViewPort = NOOP_AD_VIEW,
    private readonly adModel: AdModelPort = createNoopAdModel(),
    private readonly focusGame: () => void = () => {},
  ) {
    this.input = new InputController(() => this.state, {
      onDirection: (direction: Direction) => this.game.setDirection(direction),
      onConfirm: () => this.handleConfirm(),
      onCancel: () => this.handleCancel(),
    });
  }

  getState(): AppState {
    return this.state;
  }

  start(): void {
    if (this.state === AppState.Boot) {
      this.transition(AppState.PromptPlay);
    }
  }

  destroy(): void {
    this.stopLoop();
    this.input.destroy();
    this.adGeneration++;
    this.adModel.destroy();
    this.adView.destroy?.();
  }

  private transition(next: AppState, context?: { preRollContext?: PreRollContext }): void {
    if (next === AppState.PreRollAd && context?.preRollContext) {
      this.preRollContext = context.preRollContext;
    }
    this.state = next;

    switch (next) {
      case AppState.PreRollAd:
        this.startAd();
        break;
      case AppState.PromptPlay:
        this.stopLoop();
        this.adView.hide();
        this.gameView.hide();
        this.promptView.show('Do you want to play?');
        break;
      case AppState.Playing:
        this.adView.hide();
        this.promptView.hide();
        this.game.reset();
        this.gameView.show();
        this.gameView.render(this.game.getSnapshot());
        this.focusGameSafely();
        this.startLoop();
        break;
      case AppState.GameOver:
        this.stopLoop();
        this.transition(AppState.PostRollAd);
        break;
      case AppState.PostRollAd:
        this.startAd();
        break;
      case AppState.PromptReplay:
        this.adView.hide();
        this.gameView.hide();
        this.promptView.show('Do you want to play again?');
        break;
      case AppState.Redirect:
        this.stopLoop();
        this.adView.hide();
        this.promptView.hide();
        this.redirect(REDIRECT_URL);
        break;
      default:
        break;
    }
  }

  private handleConfirm(): void {
    if (this.state === AppState.PromptPlay) {
      this.transition(this.preRollCompleted ? AppState.Playing : AppState.PreRollAd);
    } else if (this.state === AppState.PromptReplay) {
      this.preRollCompleted = false;
      this.transition(AppState.PreRollAd, { preRollContext: 'replay' });
    }
  }

  private handleCancel(): void {
    if (this.state === AppState.PromptPlay || this.state === AppState.PromptReplay) {
      this.transition(AppState.Redirect);
    }
  }

  private startLoop(): void {
    this.stopLoop();
    this.tickId = window.setInterval(() => {
      this.game.tick();
      this.gameView.render(this.game.getSnapshot());
      if (this.game.isGameOver) {
        this.transition(AppState.GameOver);
      }
    }, TICK_MS);
  }

  private startAd(): void {
    this.stopLoop();
    this.gameView.hide();
    this.promptView.hide();
    this.adView.show();
    const generation = ++this.adGeneration;
    const finishAd = () => {
      if (
        generation !== this.adGeneration ||
        (this.state !== AppState.PreRollAd && this.state !== AppState.PostRollAd)
      ) {
        return;
      }
      if (this.state === AppState.PreRollAd) {
        this.preRollCompleted = true;
      }
      const nextState =
        this.state !== AppState.PreRollAd
          ? AppState.PromptReplay
          : this.preRollContext === 'replay'
            ? AppState.Playing
            : AppState.PromptPlay;
      this.transition(nextState);
    };
    this.adModel.onComplete = finishAd;
    this.adModel.onError = () => finishAd();
    try {
      this.adModel.requestAd();
    } catch (error) {
      console.error(error);
      finishAd();
    }
  }

  private stopLoop(): void {
    if (this.tickId !== null) {
      window.clearInterval(this.tickId);
      this.tickId = null;
    }
  }

  private focusGameSafely(): void {
    try {
      this.focusGame();
    } catch {
      // Focus is a best-effort enhancement and must not interrupt game startup.
    }
  }
}
