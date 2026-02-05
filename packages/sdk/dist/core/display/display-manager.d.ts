import { ReturnMethod } from '../../types';
import { RecommendationItem } from '../recommendation';
export declare class DisplayManager {
    private popupDisplays;
    private inlineDisplays;
    private domainKey;
    private apiBaseUrl;
    private recommendationFetcher;
    private cachedRecommendations;
    private fetchPromise;
    private refreshTimer;
    constructor(domainKey: string, apiBaseUrl: string);
    initialize(returnMethods: ReturnMethod[]): Promise<void>;
    notifyActionTriggered(): void;
    private refreshAllDisplays;
    private activateDisplayMethod;
    private initializePopup;
    private initializeInline;
    private fetchRecommendationsOnce;
    private fetchRecommendationsInternal;
    private getAnonymousId;
    getRecommendations(limit?: number): Promise<RecommendationItem[]>;
    destroy(): void;
}
//# sourceMappingURL=display-manager.d.ts.map