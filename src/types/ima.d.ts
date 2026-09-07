declare namespace google {
  namespace ima {
    class AdDisplayContainer {
      constructor(container: HTMLElement, video: HTMLVideoElement);
      initialize(): void;
      destroy(): void;
    }

    class AdsLoader {
      constructor(container: AdDisplayContainer);
      addEventListener(type: string, listener: (event: unknown) => void): void;
      requestAds(request: AdsRequest, userRequestContext?: object): void;
      destroy(): void;
    }

    class AdsRequest {
      adTagUrl: string;
      linearAdSlotWidth: number;
      linearAdSlotHeight: number;
    }

    class AdsManager {
      init(width: number, height: number, viewMode: unknown): void;
      start(): void;
      destroy(): void;
      addEventListener(type: string, listener: (event: unknown) => void): void;
    }

    const ViewMode: {
      NORMAL: unknown;
    };

    const AdEvent: {
      Type: {
        COMPLETE: string;
        SKIPPED: string;
        LOADED: string;
        ALL_ADS_COMPLETED: string;
      };
    };

    const AdErrorEvent: {
      Type: {
        AD_ERROR: string;
      };
    };

    const AdsManagerLoadedEvent: {
      Type: {
        ADS_MANAGER_LOADED: string;
      };
    };
  }
}

export {};
