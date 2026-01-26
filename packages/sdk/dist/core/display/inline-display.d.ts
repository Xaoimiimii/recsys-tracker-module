import { InlineConfig } from '../../types';
import { RecommendationItem } from '../recommendation';
export declare class InlineDisplay {
    private selector;
    private config;
    private recommendationGetter;
    private observer;
    private debounceTimer;
    private autoSlideTimeout;
    private readonly DEFAULT_DELAY;
    constructor(_domainKey: string, _slotName: string, selector: string, _apiBaseUrl: string, config: InlineConfig | undefined, recommendationGetter: () => Promise<RecommendationItem[]>);
    start(): void;
    stop(): void;
    private setupObserver;
    private scanAndRender;
    private findContainers;
    private processContainer;
    private fetchRecommendations;
    private getDynamicStyles;
    private renderItemContent;
    private renderWidget;
    private renderStaticItems;
    private setupCarousel;
    private handleItemClick;
}
//# sourceMappingURL=inline-display.d.ts.map