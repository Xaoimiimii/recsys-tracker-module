export type UserField = 'UserId' | 'Username' | 'AnonymousId';
export interface RecommendationRequest {
    UserId?: string;
    AnonymousId: string;
    DomainKey: string;
    NumberItems: number;
}
export interface RecommendationResponse {
    id: number;
    [key: string]: any;
}
export interface RecommendationItem {
    id?: number | string;
    Id?: number | string;
    [key: string]: any;
}
export interface RecommendationOptions {
    numberItems?: number;
    userField?: UserField;
}
//# sourceMappingURL=types.d.ts.map