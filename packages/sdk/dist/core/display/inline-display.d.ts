import { InlineConfig } from './types';
export declare class InlineDisplay {
    private domainKey;
    private slotName;
    private selector;
    private apiBaseUrl;
    private config;
    private observer;
    private debounceTimer;
    constructor(domainKey: string, slotName: string, selector: string, apiBaseUrl: string, config?: InlineConfig);
    start(): void;
    stop(): void;
    private scanAndRender;
    private setupObserver;
    private processContainer;
    private isPageAllowed;
    private fetchRecommendations;
    private renderWidget;
    private getWidgetStyles;
}
//# sourceMappingURL=inline-display.d.ts.map