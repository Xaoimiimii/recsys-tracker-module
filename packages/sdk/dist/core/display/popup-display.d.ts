import { PopupConfig } from './types';
import { RecommendationItem } from '../recommendation';
export declare class PopupDisplay {
    private config;
    private recommendationGetter;
    private popupTimeout;
    private autoCloseTimeout;
    private autoSlideTimeout;
    private shadowHost;
    private readonly DEFAULT_MIN_DELAY;
    private readonly DEFAULT_MAX_DELAY;
    private readonly AUTO_SLIDE_DELAY;
    constructor(_domainKey: string, _slotName: string, _apiBaseUrl: string, config: PopupConfig | undefined, recommendationGetter: () => Promise<RecommendationItem[]>);
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