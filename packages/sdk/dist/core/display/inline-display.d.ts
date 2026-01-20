import { InlineConfig } from '../../types';
import { RecommendationItem } from '../recommendation';
export declare class InlineDisplay {
    private selector;
    private config;
    private recommendationGetter;
    private observer;
    private debounceTimer;
    constructor(_domainKey: string, _slotName: string, selector: string, _apiBaseUrl: string, config: InlineConfig | undefined, recommendationGetter: () => Promise<RecommendationItem[]>);
    start(): void;
    stop(): void;
    private scanAndRender;
    private findContainers;
    private setupObserver;
    private processContainer;
    private fetchRecommendations;
    private getTokenColor;
    private getTokenRadius;
    private getWidgetStyles;
    private renderItemContent;
    private renderWidget;
}
//# sourceMappingURL=inline-display.d.ts.map