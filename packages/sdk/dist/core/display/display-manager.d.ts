import { ReturnMethod } from '../../types';
import { RecommendationItem } from '../recommendation';
export declare class DisplayManager {
    private popupDisplay;
    private inlineDisplay;
    private domainKey;
    private apiBaseUrl;
    private recommendationFetcher;
    private cachedRecommendations;
    private fetchPromise;
    private searchKeywordPlugin;
    constructor(domainKey: string, apiBaseUrl?: string);
    initialize(returnMethods: ReturnMethod[]): Promise<void>;
    /**
     * Set SearchKeywordPlugin reference (called from RecSysTracker)
     */
    setSearchKeywordPlugin(plugin: any): void;
    /**
     * Handle return method with SearchKeywordConfigID
     */
    private handleSearchKeywordReturnMethod;
    private fetchRecommendationsOnce;
    private fetchRecommendationsInternal;
    private getAnonymousId;
    getRecommendations(): Promise<RecommendationItem[]>;
    private activateDisplayMethod;
    private initializePopup;
    private initializeInline;
    destroy(): void;
}
//# sourceMappingURL=display-manager.d.ts.map