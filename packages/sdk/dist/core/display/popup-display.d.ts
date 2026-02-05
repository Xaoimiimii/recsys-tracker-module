import { PopupConfig } from '../../types';
import { RecommendationResponse } from '../recommendation';
export declare class PopupDisplay {
    private config;
    private recommendationGetter;
    private popupTimeout;
    private autoCloseTimeout;
    private autoSlideTimeout;
    private shadowHost;
    private hostId;
    private spaCheckInterval;
    private isPendingShow;
    private isManuallyClosed;
    private lastCheckedUrl;
    private readonly DEFAULT_DELAY;
    constructor(_domainKey: string, _slotName: string, _apiBaseUrl: string, config: PopupConfig | undefined, recommendationGetter: (limit: number) => Promise<RecommendationResponse>);
    start(): void;
    stop(): void;
    private generateTitle;
    updateContent(response: RecommendationResponse): void;
    private startWatcher;
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
    private handleItemClick;
}
//# sourceMappingURL=popup-display.d.ts.map