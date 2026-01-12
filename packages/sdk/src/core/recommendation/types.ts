export type UserField = 'UserId' | 'Username' | 'AnonymousId';

export interface RecommendationRequest {
  UserId?: string;
  AnonymousId: string;
  DomainKey: string;
  NumberItems: number;
}

export interface RecommendationResponse {
  Id: number;
  DomainItemId: string;
  Title: string;
  Description: string;
  ImageUrl: string | null;
}

export interface RecommendationItem {
  id: number;
  domainItemId: string;
  title: string;
  description: string;
  img: string;
}

export interface RecommendationOptions {
  numberItems?: number;
  userField?: UserField;
}
