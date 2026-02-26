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
export declare function extractFromCookie(cookieName: string): string | null;
/**
 * Extract value from localStorage
 * Automatically parses JSON if possible
 */
export declare function extractFromLocalStorage(key: string): any;
/**
 * Extract value from sessionStorage
 * Automatically parses JSON if possible
 */
export declare function extractFromSessionStorage(key: string): any;
/**
 * Parse body (JSON or text)
 * Used for request/response body parsing
 */
export declare function parseBody(body: any): any;
/**
 * Extract value by path (e.g., "data.user.id")
 * Safely navigates nested object properties
 */
export declare function extractByPath(obj: any, path: string): any;
/**
 * Extract value from URL (pathname or query parameter)
 *
 * @param url - Full URL string
 * @param value - Param name (for query) or segment index (for pathname)
 * @param extractType - 'query' or 'pathname'
 * @param requestUrlPattern - Optional pattern for param extraction (e.g., '/api/user/:id')
 */
export declare function extractFromUrl(url: string, value: string, extractType?: string, requestUrlPattern?: string): any;
/**
 * Get value from HTML element
 * Handles input, textarea, select, data attributes, and text content
 */
export declare function getElementValue(element: Element): any;
//# sourceMappingURL=data-extractors.d.ts.map