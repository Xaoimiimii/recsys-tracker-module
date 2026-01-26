export type UserField = 'UserId' | 'Username' | 'AnonymousId';

export interface RecommendationRequest {
  UserId?: string;
  AnonymousId: string;
  DomainKey: string;
  NumberItems: number;
}

export interface RecommendationResponse {
  [key: string]: any; 
}

// Interface chính dùng trong app
export interface RecommendationItem {
  id?: number | string;
  Id?: number | string;
  [key: string]: any;
}
export interface RecommendationOptions {
  numberItems?: number;
  userField?: UserField;
  autoRefresh?: boolean; // Tự động fetch lại mỗi 1 phút
  onRefresh?: (items: RecommendationItem[]) => void; // Callback khi có data mới từ auto-refresh
}
