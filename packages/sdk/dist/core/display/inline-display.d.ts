import { InlineConfig } from '../../types';
import { RecommendationResponse } from '../recommendation';
export declare class InlineDisplay {
    private selector;
    private config;
    private recommendationGetter;
    private observer;
    private debounceTimer;
    private autoSlideTimeout;
    private readonly DEFAULT_DELAY;
    private domainKey;
    private apiBaseUrl;
    constructor(_domainKey: string, _slotName: string, selector: string, _apiBaseUrl: string, config: InlineConfig | undefined, recommendationGetter: () => Promise<RecommendationResponse>);
    start(): void;
    stop(): void;
    private setupObserver;
    private scanAndRender;
    private findContainers;
    private processContainer;
    private fetchRecommendations;
    private getDynamicStyles;
    private renderSkeletonItem;
    private renderSkeletonWidget;
    private renderItemContent;
    private renderWidget;
    private renderStaticItems;
    private setupCarousel;
    private handleItemClick;
}
//# sourceMappingURL=inline-display.d.ts.map