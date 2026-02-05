export type UserField = 'UserId' | 'Username' | 'AnonymousId';
export interface RecommendationRequest {
    UserId?: string;
    AnonymousId: string;
    DomainKey: string;
    NumberItems: number;
}
export interface RecommendationResponse {
    item?: RecommendationItem[];
    items?: RecommendationItem[];
    keyword?: string;
    search?: string;
    lastItem: string;
}
export interface RecommendationItem {
    Id: number | string;
    DomainItemId: string;
    [key: string]: any;
}
export interface RecommendationOptions {
    numberItems?: number;
    userField?: UserField;
    autoRefresh?: boolean;
    onRefresh?: (items: RecommendationItem[]) => void;
}
//# sourceMappingURL=types.d.ts.map