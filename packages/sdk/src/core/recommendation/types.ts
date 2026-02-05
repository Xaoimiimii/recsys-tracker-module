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

// Interface chính dùng trong app
export interface RecommendationItem {
  Id: number | string;
  DomainItemId: string;
  [key: string]: any;
}

export interface RecommendationOptions {
  numberItems?: number;
  userField?: UserField;
  autoRefresh?: boolean; // Tự động fetch lại mỗi 1 phút
  onRefresh?: (items: RecommendationItem[]) => void; // Callback khi có data mới từ auto-refresh
}
