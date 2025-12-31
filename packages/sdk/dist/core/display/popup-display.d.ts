import { PopupConfig } from './types';
export declare class PopupDisplay {
    private domainKey;
    private slotName;
    private apiBaseUrl;
    private config;
    private popupTimeout;
    private autoCloseTimeout;
    private autoSlideTimeout;
    private shadowHost;
    private readonly DEFAULT_MIN_DELAY;
    private readonly DEFAULT_MAX_DELAY;
    private readonly AUTO_SLIDE_DELAY;
    constructor(domainKey: string, slotName: string, apiBaseUrl: string, config?: PopupConfig);
    start(): void;
    stop(): void;
    private scheduleNextPopup;
    private getRandomDelay;
    private isPageAllowed;
    private showPopup;
    private fetchRecommendations;
    private renderPopup;
    private setupCarousel;
    private removePopup;
    private clearTimeouts;
    private getPopupStyles;
}
//# sourceMappingURL=popup-display.d.ts.map