/**
 * Shared Data Extraction Utilities
 *
 * Common extraction logic used across:
 * - UserIdentityManager
 * - PayloadBuilder
 * - NetworkObserver
 *
 * Purpose: Eliminate code duplication and ensure consistent behavior
 */
/**
 * Extract value from cookie by name
 */
export function extractFromCookie(cookieName) {
    if (!cookieName)
        return null;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.split('=').map(s => s.trim());
        if (name === cookieName) {
            return decodeURIComponent(value);
        }
    }
    return null;
}
/**
 * Extract value from localStorage
 * Automatically parses JSON if possible
 */
export function extractFromLocalStorage(key) {
    if (!key)
        return null;
    try {
        const value = localStorage.getItem(key);
        if (value === null)
            return null;
        // Try parse JSON
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    catch (error) {
        return null;
    }
}
/**
 * Extract value from sessionStorage
 * Automatically parses JSON if possible
 */
export function extractFromSessionStorage(key) {
    if (!key)
        return null;
    try {
        const value = sessionStorage.getItem(key);
        if (value === null)
            return null;
        // Try parse JSON
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    catch (error) {
        return null;
    }
}
/**
 * Parse body (JSON or text)
 * Used for request/response body parsing
 */
export function parseBody(body) {
    if (!body)
        return null;
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        }
        catch {
            return body;
        }
    }
    return body;
}
/**
 * Extract value by path (e.g., "data.user.id")
 * Safely navigates nested object properties
 */
export function extractByPath(obj, path) {
    if (!path || !obj)
        return null;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) {
            return null;
        }
        current = current[part];
    }
    return current;
}
/**
 * Extract value from URL (pathname or query parameter)
 *
 * @param url - Full URL string
 * @param value - Param name (for query) or segment index (for pathname)
 * @param extractType - 'query' or 'pathname'
 * @param requestUrlPattern - Optional pattern for param extraction (e.g., '/api/user/:id')
 */
export function extractFromUrl(url, value, extractType, requestUrlPattern) {
    try {
        const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        if (extractType === 'query') {
            // Extract query parameter
            return urlObj.searchParams.get(value);
        }
        else if (extractType === 'pathname') {
            // Extract pathname segment by index
            const index = parseInt(value, 10) - 1;
            if (!isNaN(index)) {
                // Value is numeric index - extract by position
                const segments = urlObj.pathname.split('/').filter(s => s.length > 0);
                return segments[index] || null;
            }
            else if (requestUrlPattern) {
                // Value is param name - extract using pattern matching
                // This requires PathMatcher utility
                const { PathMatcher } = require('./path-matcher');
                const params = PathMatcher.extractParams(url, requestUrlPattern);
                return params[value] || null;
            }
        }
        return null;
    }
    catch (error) {
        return null;
    }
}
/**
 * Get value from HTML element
 * Handles input, textarea, select, data attributes, and text content
 */
export function getElementValue(element) {
    var _a;
    // Input elements
    if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            return element.checked;
        }
        return element.value;
    }
    // Textarea
    if (element instanceof HTMLTextAreaElement) {
        return element.value;
    }
    // Select
    if (element instanceof HTMLSelectElement) {
        return element.value;
    }
    // Data attributes
    if (element.hasAttribute('data-value')) {
        return element.getAttribute('data-value');
    }
    if (element.hasAttribute('data-id')) {
        return element.getAttribute('data-id');
    }
    // Text content
    return ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
}
//# sourceMappingURL=data-extractors.js.map