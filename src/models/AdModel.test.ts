import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_HEIGHT, AD_TAG_URL, AD_WIDTH } from '../config/adConfig';
import { AdModel, AdPhase, type ImaSdk } from './AdModel';

class MockDisplayContainer {
  initialize = vi.fn();
  destroy = vi.fn();

  constructor(public readonly container: HTMLElement, public readonly video: HTMLVideoElement) {}
}

class MockLoader {
  listeners = new Map<string, (event: unknown) => void>();
  requestContexts: object[] = [];
  requestAds = vi.fn((_request: MockRequest, context?: object) => {
    if (context) this.requestContexts.push(context);
  });
  contentComplete = vi.fn();
  destroy = vi.fn();

  constructor(
    public readonly displayContainer: { initialize: () => void; destroy: () => void },
  ) {}

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, listener);
  }

  emit(type: string, event: object = {}): void {
    const context = this.requestContexts[this.requestContexts.length - 1];
    this.listeners.get(type)?.(Object.assign(event, { getUserRequestContext: () => context }));
  }

  emitForContext(type: string, context: object, event: object = {}): void {
    this.listeners.get(type)?.({
      ...event,
      getUserRequestContext: () => context,
    });
  }
}

class MockRequest {
  adTagUrl = '';
  linearAdSlotWidth = 0;
  linearAdSlotHeight = 0;
}

class MockManager {
  listeners = new Map<string, (event: unknown) => void>();
  init = vi.fn();
  start = vi.fn();
  destroy = vi.fn();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, listener);
  }

  emit(type: string, event: unknown = {}): void {
    this.listeners.get(type)?.(event);
  }
}

describe('AdModel', () => {
  let loaders: MockLoader[];
  let loader: MockLoader;
  let manager: MockManager;
  let ima: ImaSdk;
  let model: AdModel;
  let onComplete: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    loaders = [];
    manager = new MockManager();
    ima = {
      AdDisplayContainer: MockDisplayContainer,
      AdsLoader: class extends MockLoader {
        constructor(displayContainer: { initialize: () => void; destroy: () => void }) {
          super(displayContainer);
          loader = this;
          loaders.push(this);
        }
      },
      AdsRequest: MockRequest,
      AdsManager: MockManager,
      ViewMode: { NORMAL: 'normal' },
      AdEvent: {
        Type: {
          COMPLETE: 'complete',
          SKIPPED: 'skipped',
          LOADED: 'loaded',
          ALL_ADS_COMPLETED: 'all-ads-completed',
        },
      },
      AdErrorEvent: { Type: { AD_ERROR: 'ad-error' } },
      AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'manager-loaded' } },
    };

    model = new AdModel(
      document.createElement('div'),
      document.createElement('video'),
      ima,
    );
    onComplete = vi.fn();
    onError = vi.fn();
    model.onComplete = onComplete;
    model.onError = onError;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes IMA once and requests the configured HD VAST slot', () => {
    model.requestAd();
    model.requestAd();

    const displayContainer = loader.displayContainer;
    expect(displayContainer.initialize).toHaveBeenCalledOnce();
    expect(loader.requestAds).toHaveBeenCalledOnce();
    expect(loader.requestAds.mock.calls[0][0]).toMatchObject({
      adTagUrl: AD_TAG_URL,
      linearAdSlotWidth: AD_WIDTH,
      linearAdSlotHeight: AD_HEIGHT,
    });
    expect(model.phase).toBe(AdPhase.Loading);
  });

  it('completes with an error when the IMA SDK is unavailable', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unavailableModel = new AdModel(
      document.createElement('div'),
      document.createElement('video'),
      undefined,
    );

    unavailableModel.onComplete = onComplete;
    unavailableModel.onError = onError;
    unavailableModel.requestAd();

    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(unavailableModel.phase).toBe(AdPhase.Error);
    consoleError.mockRestore();
  });

  it('completes with an error when an ad request cannot be created', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    ima.AdsRequest = class {
      constructor() {
        throw new Error('request construction failed');
      }
    } as ImaSdk['AdsRequest'];

    model.requestAd();

    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(model.phase).toBe(AdPhase.Error);
    consoleError.mockRestore();
  });

  it('retires the completed manager before requesting an ad again', () => {
    model.requestAd();
    const firstLoader = loader;
    firstLoader.emit('manager-loaded', {
      getAdsManager: () => {
        manager = new MockManager();
        return manager;
      },
    });
    manager.emit('complete');

    model.requestAd();

    expect(manager.destroy).toHaveBeenCalledOnce();
    expect(firstLoader.displayContainer.initialize).toHaveBeenCalledOnce();
    expect(model.phase).toBe(AdPhase.Loading);
    expect(firstLoader.contentComplete).toHaveBeenCalledOnce();
    expect(loaders).toHaveLength(1);
    expect(firstLoader.requestAds).toHaveBeenCalledTimes(2);
  });

  it('reuses the loader and resets it before requesting a replay ad', () => {
    model.requestAd();
    loader.emit('manager-loaded', { getAdsManager: () => manager });
    manager.emit('complete');

    model.requestAd();

    expect(loaders).toHaveLength(1);
    expect(loader.contentComplete).toHaveBeenCalledOnce();
    expect(loader.requestAds).toHaveBeenCalledTimes(2);
  });

  it('ignores events from a retired manager', () => {
    model.requestAd();
    const firstLoader = loader;
    const firstManager = new MockManager();
    firstLoader.emit('manager-loaded', { getAdsManager: () => firstManager });
    firstManager.emit('complete');

    model.requestAd();
    const secondLoader = loader;
    const secondManager = new MockManager();
    secondLoader.emit('manager-loaded', { getAdsManager: () => secondManager });
    firstManager.emit('ad-error', new Error('stale failure'));

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(model.phase).toBe(AdPhase.Playing);
  });

  it('ignores delayed loader events from the previous request', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    model.requestAd();
    const firstLoader = loader;
    const firstManager = new MockManager();
    firstLoader.emit('manager-loaded', { getAdsManager: () => firstManager });
    firstManager.emit('complete');
    onComplete.mockClear();
    onError.mockClear();
    const firstContext = firstLoader.requestContexts[0];

    model.requestAd();
    const secondContext = firstLoader.requestContexts[1];
    const secondManager = new MockManager();

    firstLoader.emitForContext('manager-loaded', firstContext, {
      getAdsManager: () => {
        throw new Error('stale manager must not be created');
      },
    });
    firstLoader.emitForContext('ad-error', firstContext, {
      getError: () => new Error('stale failure'),
    });

    expect(model.phase).toBe(AdPhase.Loading);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    firstLoader.emitForContext('manager-loaded', secondContext, {
      getAdsManager: () => secondManager,
    });

    expect(model.phase).toBe(AdPhase.Playing);
    expect(secondManager.start).toHaveBeenCalledOnce();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each(['complete', 'skipped', 'all-ads-completed'])(
    'completes when IMA emits %s',
    (eventType) => {
      model.requestAd();
      loader.emit('manager-loaded', {
        getAdsManager: () => manager,
      });

      expect(manager.init).toHaveBeenCalledWith(AD_WIDTH, AD_HEIGHT, 'normal');
      expect(manager.start).toHaveBeenCalledOnce();

      manager.emit(eventType);

      expect(onComplete).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
      expect(model.phase).toBe(AdPhase.Complete);
    },
  );

  it('fails open after the per-ad watchdog expires', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    model.requestAd();

    vi.advanceTimersByTime(10_000);

    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(model.phase).toBe(AdPhase.Error);
    vi.advanceTimersByTime(10_000);
    expect(onComplete).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('clears the watchdog on completion, error, and destroy', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    model.requestAd();
    expect(vi.getTimerCount()).toBe(1);
    loader.emit('manager-loaded', { getAdsManager: () => manager });
    manager.emit('complete');
    expect(vi.getTimerCount()).toBe(0);

    model.requestAd();
    expect(vi.getTimerCount()).toBe(1);
    loader.emit('ad-error', { getError: () => new Error('ad failed') });
    expect(vi.getTimerCount()).toBe(0);

    model.requestAd();
    expect(vi.getTimerCount()).toBe(1);
    model.destroy();
    expect(vi.getTimerCount()).toBe(0);
    consoleError.mockRestore();
  });

  it('treats an unattributable loader error as the current request error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    model.requestAd();
    loader.listeners.get('ad-error')?.({ getError: () => new Error('unattributable failure') });

    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(model.phase).toBe(AdPhase.Error);
    consoleError.mockRestore();
  });

  it('destroys the manager before invoking completion', () => {
    model.requestAd();
    loader.emit('manager-loaded', { getAdsManager: () => manager });
    manager.destroy.mockImplementationOnce(() => {
      expect(onComplete).not.toHaveBeenCalled();
    });

    manager.emit('complete');

    expect(manager.destroy).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('reports an ad error and completes so the game can continue', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    model.requestAd();

    loader.emit('ad-error', { getError: () => new Error('ad failed') });

    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(model.phase).toBe(AdPhase.Error);
    consoleError.mockRestore();
  });

  it('destroys IMA resources', () => {
    model.requestAd();
    loader.emit('manager-loaded', { getAdsManager: () => manager });

    model.destroy();

    expect(manager.destroy).toHaveBeenCalledOnce();
    expect(loader.destroy).toHaveBeenCalledOnce();
    expect(loader.displayContainer.destroy).toHaveBeenCalledOnce();
  });

  it('attempts every cleanup even when an earlier cleanup throws', () => {
    model.requestAd();
    loader.emit('manager-loaded', { getAdsManager: () => manager });
    manager.destroy.mockImplementationOnce(() => {
      throw new Error('manager cleanup failed');
    });
    loader.destroy.mockImplementationOnce(() => {
      throw new Error('loader cleanup failed');
    });
    const displayDestroy = loader.displayContainer.destroy as ReturnType<typeof vi.fn>;
    displayDestroy.mockImplementationOnce(() => {
      throw new Error('display cleanup failed');
    });

    expect(() => model.destroy()).not.toThrow();
    expect(manager.destroy).toHaveBeenCalledOnce();
    expect(loader.destroy).toHaveBeenCalledOnce();
    expect(displayDestroy).toHaveBeenCalledOnce();
    expect(() => model.destroy()).not.toThrow();
  });

  it('completes when error extraction and error callback both throw', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    onError.mockImplementation(() => {
      throw new Error('error callback failed');
    });
    const event = {
      getError: () => {
        throw new Error('error extraction failed');
      },
    };

    model.requestAd();
    expect(() => loader.emit('ad-error', event)).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith(event);
    expect(onError).toHaveBeenCalledWith(event);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(model.phase).toBe(AdPhase.Error);
    consoleError.mockRestore();
  });
});
