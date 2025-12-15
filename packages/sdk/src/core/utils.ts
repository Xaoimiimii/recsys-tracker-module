
export const STORAGE_KEYS = {
    ANON_USER_ID: 'recsys_anon_id',
    USER_ID: 'recsys_user_id',
    SESSION_ID: 'recsys_session',
    IDENTIFIERS: 'recsys_identifiers',
    LAST_USER_ID: 'recsys_last_user_id'
};

export const DEBUG = false;

export function log(...args: any[]) {
    if (DEBUG) {
        console.log('[Recsys DEBUG]', ...args);
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

export function checkRuleCondition(url: string, condition: ICondition): boolean {
    if (condition.type === "NONE") { return true; }
    let urlPath: string;
    try {
        urlPath = new URL(url).pathname;
    } catch (e) {
        urlPath = "";
    }
    if (
        condition.type === "URL_PATH" &&
        condition.operator === "equals" &&
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