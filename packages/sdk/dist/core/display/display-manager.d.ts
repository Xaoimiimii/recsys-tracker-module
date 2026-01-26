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
    constructor(domainKey: string, apiBaseUrl?: string);
    initialize(returnMethods: ReturnMethod[]): Promise<void>;
    /**
     * Set SearchKeywordPlugin reference (called from RecSysTracker)
     */
    /**
     * Handle return method with SearchKeywordConfigID
     */
    private activateDisplayMethod;
    private initializePopup;
    private initializeInline;
    private fetchRecommendationsOnce;
    private fetchRecommendationsInternal;
    private getAnonymousId;
    getRecommendations(): Promise<RecommendationItem[]>;
    destroy(): void;
}
//# sourceMappingURL=display-manager.d.ts.map