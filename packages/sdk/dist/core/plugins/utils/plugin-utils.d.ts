export declare const STORAGE_KEYS: {
    ANON_USER_ID: string;
    USER_ID: string;
    SESSION_ID: string;
    IDENTIFIERS: string;
    LAST_USER_ID: string;
    CACHED_USER_INFO: string;
};
export declare const DEBUG = false;
export declare function log(...args: any[]): void;
/**
 * Interface cho cached user info
 */
export interface CachedUserInfo {
    userField: string;
    userValue: string;
    timestamp: number;
}
/**
 * Lưu user info vào localStorage khi bắt được từ rule
 * @param userField - UserId hoặc Username
 * @param userValue - Giá trị user đã bắt được
 */
export declare function saveCachedUserInfo(userField: string, userValue: string): void;
/**
 * Lấy cached user info từ localStorage
 * @returns CachedUserInfo hoặc null nếu không có
 */
export declare function getCachedUserInfo(): CachedUserInfo | null;
/**
 * Khởi tạo và lấy Anonymous ID từ localStorage
 * Tự động tạo mới nếu chưa tồn tại
 */
export declare function getOrCreateAnonymousId(): string;
export declare function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void;
//# sourceMappingURL=plugin-utils.d.ts.map