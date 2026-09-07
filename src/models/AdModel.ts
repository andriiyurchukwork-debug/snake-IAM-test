import { AD_HEIGHT, AD_TAG_URL, AD_WIDTH } from '../config/adConfig';

export enum AdPhase {
  Idle = 'IDLE',
  Loading = 'LOADING',
  Playing = 'PLAYING',
  Complete = 'COMPLETE',
  Error = 'ERROR',
}

interface ImaDisplayContainer {
  initialize(): void;
  destroy(): void;
}

interface ImaAdsLoader {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  contentComplete(): void;
  requestAds(request: ImaAdsRequest, userRequestContext?: object): void;
  destroy(): void;
}

interface ImaAdsRequest {
  adTagUrl: string;
  linearAdSlotWidth: number;
  linearAdSlotHeight: number;
}

interface ImaAdsManager {
  init(width: number, height: number, viewMode: unknown): void;
  start(): void;
  destroy(): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

export interface ImaSdk {
  AdDisplayContainer: new (
    container: HTMLElement,
    video: HTMLVideoElement,
  ) => ImaDisplayContainer;
  AdsLoader: new (container: ImaDisplayContainer) => ImaAdsLoader;
  AdsRequest: new () => ImaAdsRequest;
  AdsManager: new (...args: never[]) => ImaAdsManager;
  ViewMode: { NORMAL: unknown };
  AdEvent: {
    Type: {
      COMPLETE: string;
      SKIPPED: string;
      LOADED: string;
      ALL_ADS_COMPLETED: string;
    };
  };
  AdErrorEvent: { Type: { AD_ERROR: string } };
  AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
}

interface AdsManagerLoadedEvent {
  getAdsManager(video: HTMLVideoElement): ImaAdsManager;
  getUserRequestContext(): object;
}

type AdErrorEvent = { getError?: () => unknown; getUserRequestContext?: () => object } | unknown;

export class AdModel {
  private readonly ima: ImaSdk | null;
  private readonly displayContainer: ImaDisplayContainer | null;
  private loader: ImaAdsLoader | null = null;
  private manager: ImaAdsManager | null = null;
  private displayInitialized = false;
  private completed = false;
  private destroyed = false;
  private readonly initializationError: unknown;
  private runGeneration = 0;
  private activeRequestContext: object | null = null;
  private watchdogId: ReturnType<typeof setTimeout> | null = null;
  private _phase = AdPhase.Idle;

  onComplete: () => void = () => {};
  onError: (error: unknown) => void = () => {};

  constructor(
    private readonly container: HTMLElement,
    private readonly video: HTMLVideoElement,
    ima?: ImaSdk,
  ) {
    this.ima = ima ?? this.getGlobalIma();
    if (!this.ima) {
      this.displayContainer = null;
      this.initializationError = new Error('Google IMA SDK is not available');
      return;
    }
    try {
      this.displayContainer = new this.ima.AdDisplayContainer(container, video);
      this.initializationError = null;
    } catch (error) {
      this.displayContainer = null;
      this.initializationError = error;
    }
  }

  get phase(): AdPhase {
    return this._phase;
  }

  requestAd(): void {
    if (this.destroyed || this._phase === AdPhase.Loading || this._phase === AdPhase.Playing) {
      return;
    }

    this.retireManager();
    this.clearWatchdog();
    const generation = ++this.runGeneration;
    const requestContext = { generation };
    this.activeRequestContext = requestContext;
    this.completed = false;
    this._phase = AdPhase.Loading;
    this.watchdogId = setTimeout(() => {
      this.handleError(new Error('IMA ad request timed out'), generation);
    }, 10_000);
    this.initialize(generation);

    try {
      if (generation > 1) {
        this.loader?.contentComplete();
      }
      if (this.initializationError) throw this.initializationError;
      if (!this.ima) throw new Error('Google IMA SDK is not available');
      if (this.completed) return;
      const request = new this.ima.AdsRequest();
      request.adTagUrl = AD_TAG_URL;
      request.linearAdSlotWidth = AD_WIDTH;
      request.linearAdSlotHeight = AD_HEIGHT;
      this.loader?.requestAds(request, requestContext);
    } catch (error) {
      this.handleError(error, generation);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.runGeneration++;
    this.activeRequestContext = null;
    this.clearWatchdog();
    this.retireManager();
    const loader = this.loader;
    this.loader = null;
    try {
      loader?.destroy();
    } catch {
      // Cleanup must continue even if the loader rejects destruction.
    }
    try {
      this.displayContainer?.destroy();
    } catch {
      // Cleanup must continue even if the display container rejects destruction.
    }
  }

  private initialize(generation: number): void {
    if (this.loader || !this.ima || !this.displayContainer) return;

    try {
      if (!this.displayInitialized) {
        this.displayContainer.initialize();
        this.displayInitialized = true;
      }
      this.loader = new this.ima.AdsLoader(this.displayContainer);
      this.loader.addEventListener(
        this.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (event) => this.handleManagerLoaded(event),
      );
      this.loader.addEventListener(this.ima.AdErrorEvent.Type.AD_ERROR, (event) => {
        const eventGeneration = this.getEventGeneration(event);
        this.handleError(event, eventGeneration === -1 ? -1 : this.runGeneration);
      });
    } catch (error) {
      this.handleError(error, generation);
    }
  }

  private handleManagerLoaded(event: unknown): void {
    const generation = this.getEventGeneration(event);
    if (this.completed || this.destroyed || generation !== this.runGeneration) return;

    try {
      if (!this.ima) throw new Error('Google IMA SDK is not available');
      this.manager = (event as AdsManagerLoadedEvent).getAdsManager(this.video);
      this.manager.addEventListener(this.ima.AdEvent.Type.COMPLETE, () => this.handleComplete(generation));
      this.manager.addEventListener(this.ima.AdEvent.Type.SKIPPED, () => this.handleComplete(generation));
      this.manager.addEventListener(
        this.ima.AdEvent.Type.ALL_ADS_COMPLETED,
        () => this.handleComplete(generation),
      );
      this.manager.addEventListener(this.ima.AdErrorEvent.Type.AD_ERROR, (error) => {
        this.handleError(error, generation);
      });
      this._phase = AdPhase.Playing;
      this.manager.init(AD_WIDTH, AD_HEIGHT, this.ima.ViewMode.NORMAL);
      this.manager.start();
    } catch (error) {
      this.handleError(error, generation);
    }
  }

  private handleComplete(generation: number): void {
    if (this.completed || this.destroyed || generation !== this.runGeneration) return;
    this.completed = true;
    this._phase = AdPhase.Complete;
    this.clearWatchdog();
    this.retireManager();
    try {
      this.onComplete();
    } catch {
      // Callback failures must not corrupt the completed lifecycle state.
    }
  }

  private handleError(event: AdErrorEvent, generation: number): void {
    if (this.completed || this.destroyed || generation !== this.runGeneration) return;
    this.completed = true;
    this._phase = AdPhase.Error;
    this.clearWatchdog();
    this.retireManager();
    let error = event;
    try {
      if (
        typeof event === 'object' &&
        event !== null &&
        'getError' in event &&
        typeof event.getError === 'function'
      ) {
        error = event.getError();
      }
    } catch {
      error = event;
    }
    console.error(error);
    try {
      this.onError(error);
    } catch {
      // Always fall through to completion when an error callback fails.
    }
    try {
      this.onComplete();
    } catch {
      // Callback failures must not escape the IMA event handler.
    }
  }

  private getEventGeneration(event: unknown): number | null {
    if (
      typeof event !== 'object' ||
      event === null ||
      !('getUserRequestContext' in event) ||
      typeof event.getUserRequestContext !== 'function'
    ) {
      return null;
    }

    try {
      const context = event.getUserRequestContext();
      if (context === null || context === undefined) return null;
      return context === this.activeRequestContext
        ? (context as { generation: number }).generation
        : -1;
    } catch {
      return null;
    }
  }

  private clearWatchdog(): void {
    if (this.watchdogId !== null) {
      clearTimeout(this.watchdogId);
      this.watchdogId = null;
    }
  }

  private retireManager(): void {
    const manager = this.manager;
    this.manager = null;
    try {
      manager?.destroy();
    } catch {
      // Continue retiring all resources.
    }
  }

  private getGlobalIma(): ImaSdk | null {
    const ima = (globalThis as typeof globalThis & { google?: { ima?: ImaSdk } }).google?.ima;
    return ima ?? null;
  }
}
