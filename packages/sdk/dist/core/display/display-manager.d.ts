import { ReturnMethod } from '../../types';
import { RecommendationItem } from '../recommendation';
export declare class DisplayManager {
    private popupDisplay;
    private inlineDisplay;
    private apiBaseUrl;
    private recommendationFetcher;
    private cachedRecommendations;
    private fetchPromise;
    constructor(apiBaseUrl?: string);
    initialize(returnMethods: ReturnMethod[]): Promise<void>;
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