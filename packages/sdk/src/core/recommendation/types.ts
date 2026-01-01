export type UserField = 'UserId' | 'Username' | 'AnonymousId';

export interface RecommendationRequest {
  UserValue: string;
  UserField: UserField;
  DomainKey: string;
  NumberItems: number;
}

export interface RecommendationResponse {
  Id: number;
  DomainItemId: string;
  Title: string;
  Description: string;
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
