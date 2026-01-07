import { Condition } from '../../../types';

export const STORAGE_KEYS = {
    ANON_USER_ID: 'recsys_anon_id',
    USER_ID: 'recsys_user_id',
    SESSION_ID: 'recsys_session',
    IDENTIFIERS: 'recsys_identifiers',
    LAST_USER_ID: 'recsys_last_user_id',
    CACHED_USER_INFO: 'recsys_cached_user_info' // Lưu user info đã bắt được
};

export const DEBUG = false;

export function log(...args: any[]) {
    if (DEBUG) {
        console.log('[Recsys DEBUG]', ...args);
    }
}

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
export function saveCachedUserInfo(userField: string, userValue: string): void {
    // Chỉ lưu nếu userValue valid (không phải AnonymousId, guest, empty)
    if (!userValue || 
        userValue === 'guest' || 
        userValue.startsWith('anon_') || 
        userField === 'AnonymousId') {
        return;
    }

    try {
        const cachedInfo: CachedUserInfo = {
            userField,
            userValue,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.CACHED_USER_INFO, JSON.stringify(cachedInfo));
        log('Saved cached user info:', cachedInfo);
    } catch (error) {
        log('Failed to save cached user info:', error);
    }
}

/**
 * Lấy cached user info từ localStorage
 * @returns CachedUserInfo hoặc null nếu không có
 */
export function getCachedUserInfo(): CachedUserInfo | null {
    try {
        const cached = localStorage.getItem(STORAGE_KEYS.CACHED_USER_INFO);
        if (!cached) {
            return null;
        }
        
        const userInfo: CachedUserInfo = JSON.parse(cached);
        
        // Validate cached data
        if (userInfo.userField && userInfo.userValue && userInfo.timestamp) {
            log('Retrieved cached user info:', userInfo);
            return userInfo;
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Khởi tạo và lấy Anonymous ID từ localStorage
 * Tự động tạo mới nếu chưa tồn tại
 */
export function getOrCreateAnonymousId(): string {
    try {
        let anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
        
        if (!anonId) {
            // Generate new anonymous ID: anon_timestamp_randomstring
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 10);
            anonId = `anon_${timestamp}_${randomStr}`;
            localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, anonId);
            log('Created new anonymous ID:', anonId);
        }
        
        return anonId;
    } catch (error) {
        // Fallback nếu localStorage không available
        return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
}

export function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: number | null = null;
    let lastArgs: Parameters<T> | null = null;

    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        const now = Date.now();
        lastArgs = args;
        const remaining = delay - (now - lastCall);
        
        const context = this;

        if (remaining <= 0) {
            if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
            lastCall = now;
            fn.apply(context, args);
        } else if (!timeoutId) {
            timeoutId = window.setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn.apply(context, lastArgs as Parameters<T>);
            }, remaining);
        }
    };
}

export function checkRuleCondition(url: string, condition: Condition): boolean {
    if (condition.patternId === 0) { return true; }
    let urlPath: string;
    try {
        urlPath = new URL(url).pathname;
    } catch (e) {
        urlPath = "";
    }
    if (
        condition.patternId === 2 &&
        condition.operatorId === 5 &&
        condition.value
    ) {
        return urlPath === condition.value;
    }
    return true;
}


export const CUSTOM_ROUTE_EVENT = "recsys_route_change";
export function setupSPARouterWrapper() {
    const history = window.history;
    if (!history) return;
    
    (["pushState", "replaceState"] as const).forEach((method) => {
        if (typeof history[method] === "function") {
            const originalMethod = history[method];
            (history as any)[method] = function (...args: any[]) {
                const result = originalMethod.apply(history, args as any);
                const customEvent = new Event(CUSTOM_ROUTE_EVENT);
                window.dispatchEvent(customEvent);
                return result;
            };
        }
    });
}