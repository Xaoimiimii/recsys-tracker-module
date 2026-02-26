import { RecommendationResponse, RecommendationOptions, UserField } from './types';
export declare class RecommendationFetcher {
    private domainKey;
    private apiBaseUrl;
    private cache;
    private readonly CACHE_TTL;
    private readonly AUTO_REFRESH_INTERVAL;
    private autoRefreshTimers;
    private refreshCallbacks;
    constructor(domainKey: string, apiBaseUrl: string);
    fetchRecommendations(userValue: string, userField?: UserField, _options?: RecommendationOptions): Promise<RecommendationResponse>;
    enableAutoRefresh(userValue: string, userField: UserField | undefined, callback: (data: RecommendationResponse) => void, options?: RecommendationOptions): () => void;
    private stopAutoRefresh;
    stopAllAutoRefresh(): void;
    fetchForAnonymousUser(options?: RecommendationOptions): Promise<RecommendationResponse>;
    fetchForUserId(userId: string, options?: RecommendationOptions): Promise<RecommendationResponse>;
    fetchForUsername(username: string, options?: RecommendationOptions): Promise<RecommendationResponse>;
    private transformResponse;
    private getOrCreateAnonymousId;
    private generateRandomString;
    private getCachedUserId;
    private getCacheKey;
    private getFromCache;
    private saveToCache;
    clearCache(): void;
    setApiBaseUrl(url: string): void;
}
//# sourceMappingURL=recommendation-fetcher.d.ts.map