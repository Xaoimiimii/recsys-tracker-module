export interface IAIItemDetectionResult {
    id: string;
    name?: string;
    type?: string;
    confidence: number;
    source: string;
    context?: string;
    metadata?: any;
}
export declare class AIItemDetector {
    private itemCache;
    private domObserver;
    constructor();
    init(): void;
    private detectItemFromClick;
    private detectItemFromDOM;
    private detectItemFromChildren;
    private detectItemFromText;
    private detectItemFromLimitedText;
    private detectItemFromMedia;
    detectItemFromStructuredData(element: Element): IAIItemDetectionResult | null;
    private detectItemFromPosition;
    private extractItemDataFromElement;
    private getTextContext;
    private findNearbyMedia;
    private analyzeImage;
    private analyzeVideo;
    private extractNameFromSrc;
    private extractMicrodata;
    private extractJsonLdData;
    private findMatchingItemInJsonLd;
    extractOpenGraphData(): Record<string, any> | null;
    private extractNameFromPosition;
    private inferTypeFromAttribute;
    private generateHashId;
    private hashString;
    private setupDOMMutationObserver;
    private scanNewContent;
    detectItem(eventOrElement: Event | Element | null): IAIItemDetectionResult | null;
}
export declare function getAIItemDetector(): AIItemDetector;
//# sourceMappingURL=ai-item-detector.d.ts.map