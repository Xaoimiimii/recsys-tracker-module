export const STORAGE_KEYS = {
    ANON_USER_ID: 'recsys_anon_id',
    USER_ID: 'recsys_user_id',
    SESSION_ID: 'recsys_session',
    IDENTIFIERS: 'recsys_identifiers',
    LAST_USER_ID: 'recsys_last_user_id',
    CACHED_USER_INFO: 'recsys_cached_user_info' // Lưu user info đã bắt được
};
export const DEBUG = false;
export function log(...args) {
    if (DEBUG) {
        console.log('[Recsys DEBUG]', ...args);
    }
}
/**
 * Lưu user info vào localStorage khi bắt được từ rule
 * @param userField - UserId hoặc Username
 * @param userValue - Giá trị user đã bắt được
 */
export function saveCachedUserInfo(userField, userValue) {
    console.log('[plugin-utils] saveCachedUserInfo called - field:', userField, 'value:', userValue);
    // Chỉ lưu nếu userValue valid (không phải AnonymousId, guest, empty)
    if (!userValue ||
        userValue === 'guest' ||
        userValue.startsWith('anon_') ||
        userField === 'AnonymousId') {
        console.log('[plugin-utils] Skipping save - invalid user value or AnonymousId');
        return;
    }
    try {
        const cachedInfo = {
            userField,
            userValue,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEYS.CACHED_USER_INFO, JSON.stringify(cachedInfo));
        console.log('[plugin-utils] Successfully saved cached user info:', cachedInfo);
        log('Saved cached user info:', cachedInfo);
    }
    catch (error) {
        console.error('[plugin-utils] Failed to save cached user info:', error);
        log('Failed to save cached user info:', error);
    }
}
/**
 * Lấy cached user info từ localStorage
 * @returns CachedUserInfo hoặc null nếu không có
 */
export function getCachedUserInfo() {
    try {
        const cached = localStorage.getItem(STORAGE_KEYS.CACHED_USER_INFO);
        console.log('[plugin-utils] getCachedUserInfo - raw cached value:', cached);
        if (!cached) {
            console.log('[plugin-utils] No cached user info found');
            return null;
        }
        const userInfo = JSON.parse(cached);
        console.log('[plugin-utils] Parsed cached user info:', userInfo);
        // Validate cached data
        if (userInfo.userField && userInfo.userValue && userInfo.timestamp) {
            console.log('[plugin-utils] Valid cached user info:', userInfo);
            log('Retrieved cached user info:', userInfo);
            return userInfo;
        }
        console.log('[plugin-utils] Invalid cached user info structure');
        return null;
    }
    catch (error) {
        console.error('[plugin-utils] Error reading cached user info:', error);
        return null;
    }
}
/**
 * Khởi tạo và lấy Anonymous ID từ localStorage
 * Tự động tạo mới nếu chưa tồn tại
 */
export function getOrCreateAnonymousId() {
    try {
        let anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
        console.log('[plugin-utils] getOrCreateAnonymousId - existing anonId:', anonId);
        if (!anonId) {
            // Generate new anonymous ID: anon_timestamp_randomstring
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 10);
            anonId = `anon_${timestamp}_${randomStr}`;
            localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, anonId);
            console.log('[plugin-utils] Created new anonymous ID:', anonId);
            log('Created new anonymous ID:', anonId);
        }
        else {
            console.log('[plugin-utils] Using existing anonymous ID:', anonId);
        }
        return anonId;
    }
    catch (error) {
        console.error('[plugin-utils] Error accessing localStorage for anonId:', error);
        // Fallback nếu localStorage không available
        const fallbackId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        console.log('[plugin-utils] Using fallback anonymous ID:', fallbackId);
        return fallbackId;
    }
}
export function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    let lastArgs = null;
    return function (...args) {
        const now = Date.now();
        lastArgs = args;
        const remaining = delay - (now - lastCall);
        const context = this;
        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            fn.apply(context, args);
        }
        else if (!timeoutId) {
            timeoutId = window.setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn.apply(context, lastArgs);
            }, remaining);
        }
    };
}
//# sourceMappingURL=plugin-utils.js.map