import { PopupConfig } from '../../types';
import { RecommendationItem } from '../recommendation';
export declare class PopupDisplay {
    private config;
    private recommendationGetter;
    private popupTimeout;
    private autoCloseTimeout;
    private autoSlideTimeout;
    private shadowHost;
    private spaCheckInterval;
    private isPendingShow;
    private isManuallyClosed;
    private readonly DEFAULT_DELAY;
    constructor(_domainKey: string, _slotName: string, _apiBaseUrl: string, config: PopupConfig | undefined, recommendationGetter: () => Promise<RecommendationItem[]>);
    start(): void;
    stop(): void;
    private startWatcher;
    private scheduleShow;
    private showPopup;
    private shouldShowPopup;
    private scheduleNextPopup;
    private fetchRecommendations;
    private getDynamicStyles;
    private renderItemContent;
    private renderPopup;
    private renderStaticItems;
    private setupCarousel;
    private removePopup;
    private clearTimeouts;
}
//# sourceMappingURL=popup-display.d.ts.map