export const STORAGE_KEYS = {
    ANON_USER_ID: 'recsys_anon_id',
    USER_ID: 'recsys_user_id',
    SESSION_ID: 'recsys_session',
    IDENTIFIERS: 'recsys_identifiers',
    LAST_USER_ID: 'recsys_last_user_id'
};
export const DEBUG = false;
export function log(...args) {
    if (DEBUG) {
        console.log('[Recsys DEBUG]', ...args);
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
export function checkRuleCondition(url, condition) {
    if (condition.type === "NONE") {
        return true;
    }
    let urlPath;
    try {
        urlPath = new URL(url).pathname;
    }
    catch (e) {
        urlPath = "";
    }
    if (condition.type === "URL_PATH" &&
        condition.operator === "equals" &&
        condition.value) {
        return urlPath === condition.value;
    }
    return true;
}
export const CUSTOM_ROUTE_EVENT = "recsys_route_change";
export function setupSPARouterWrapper() {
    const history = window.history;
    if (!history)
        return;
    ["pushState", "replaceState"].forEach((method) => {
        if (typeof history[method] === "function") {
            const originalMethod = history[method];
            history[method] = function (...args) {
                const result = originalMethod.apply(history, args);
                const customEvent = new Event(CUSTOM_ROUTE_EVENT);
                window.dispatchEvent(customEvent);
                return result;
            };
        }
    });
}
//# sourceMappingURL=plugin-utils.js.map