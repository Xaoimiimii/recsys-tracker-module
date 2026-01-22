import { InlineConfig } from '../../types';
export declare class InlineDisplay {
    private selector;
    private config;
    private observer;
    private debounceTimer;
    private autoSlideTimeout;
    private readonly DEFAULT_DELAY;
    constructor(_domainKey: string, _slotName: string, selector: string, _apiBaseUrl: string, config?: InlineConfig);
    start(): void;
    stop(): void;
    private setupObserver;
    private scanAndRender;
    private findContainers;
    private processContainer;
    private getDynamicStyles;
    private renderItemContent;
    private renderWidget;
    private renderStaticItems;
    private setupCarousel;
}
//# sourceMappingURL=inline-display.d.ts.map