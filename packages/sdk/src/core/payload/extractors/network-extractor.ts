import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
import { PathMatcher } from '../../utils/path-matcher';

export interface NetworkContext {
    reqBody?: any;
    resBody?: any;
    method?: string;
    url?: string;
}

/**
 * NetworkExtractor handles:
 * 1. Extracting data from network request/response (extract method)
 * 2. Network tracking via XHR/Fetch hooking (enableTracking/disableTracking)
 * 3. Matching network requests against rules and dispatching events
 */
export class NetworkExtractor implements IPayloadExtractor {
    private originalXmlOpen: any;
    private originalXmlSend: any;
    private originalFetch: any;
    private isTrackingActive: boolean = false;
    private trackerConfig: any = null;
    private onNetworkMatchCallback?: (rule: any, extractedData: any, context: NetworkContext) => void;

    /**
     * Extract data from network request/response based on mapping
     * This is called by PayloadBuilder when processing network_request mappings
     */
    extract(mapping: PayloadMapping, context?: any): any {
        if (!context) return null;

        // Check if mapping matches context URL (basic validation)
        if (mapping.requestUrlPattern && context.url) {
            if (!this.matchesUrl(context.url, mapping.requestUrlPattern)) {
                return null;
            }
        }

        const source = (mapping.source || '').toLowerCase();
        const path = mapping.value || mapping.requestBodyPath; // Backward compat or direct value

        if (!path) {
            return null;
        }

        if (source === 'requestbody' || source === 'request_body') {
            let result = this.traverseObject(context.reqBody, path);
            
            // Fallback: If GET request has no request body, try response body
            if (!this.isValid(result) && context.method?.toUpperCase() === 'GET') {
                result = this.traverseObject(context.resBody, path);
            }
            
            return result;
        }

        if (source === 'responsebody' || source === 'response_body') {
            const result = this.traverseObject(context.resBody, path);
            return result;
        }

        if (source === 'network_request') {
            // Smart inference based on HTTP method
            const method = context.method?.toUpperCase();
            
            if (method === 'GET') {
                // For GET requests, data typically comes from response
                return this.traverseObject(context.resBody, path);
            } else {
                // For POST/PUT/PATCH, try request first, then fallback to response
                let val = this.traverseObject(context.reqBody, path);
                if (this.isValid(val)) return val;

                val = this.traverseObject(context.resBody, path);
                if (this.isValid(val)) return val;
            }
        }

        return null;
    }

    /**
     * Enable network tracking by hooking into XHR and Fetch APIs
     */
    public enableTracking(config: any, onMatch?: (rule: any, data: any, context: NetworkContext) => void): void {
        if (this.isTrackingActive) {
            console.warn('[NetworkExtractor] Network tracking is already active');
            return;
        }

        this.trackerConfig = config;
        this.onNetworkMatchCallback = onMatch;
        this.hookXhr();
        this.hookFetch();
        this.isTrackingActive = true;
        console.log('[NetworkExtractor] Network tracking enabled');
    }

    /**
     * Disable network tracking and restore original XHR/Fetch
     */
    public disableTracking(): void {
        if (!this.isTrackingActive) return;

        this.restoreXhr();
        this.restoreFetch();
        this.isTrackingActive = false;
        this.trackerConfig = null;
        this.onNetworkMatchCallback = undefined;
        console.log('[NetworkExtractor] Network tracking disabled');
    }

    /**
     * Check if network tracking is currently active
     */
    public isTracking(): boolean {
        return this.isTrackingActive;
    }

    // --- XHR HOOKING ---

    private hookXhr(): void {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;

        const extractor = this;

        // Hook open() to capture method and URL
        XMLHttpRequest.prototype.open = function (method: string, url: string) {
            (this as any)._networkTrackInfo = { 
                method, 
                url, 
                startTime: Date.now() 
            };
            return extractor.originalXmlOpen.apply(this, arguments as any);
        };

        // Hook send() to capture request body and response
        XMLHttpRequest.prototype.send = function (body: any) {
            const info = (this as any)._networkTrackInfo;
            if (info) {
                this.addEventListener('load', () => {
                    extractor.handleNetworkRequest(
                        info.url,
                        info.method,
                        body,
                        this.response
                    );
                });
            }
            return extractor.originalXmlSend.apply(this, arguments as any);
        };
    }

    private restoreXhr(): void {
        if (this.originalXmlOpen) {
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        }
        if (this.originalXmlSend) {
            XMLHttpRequest.prototype.send = this.originalXmlSend;
        }
    }

    // --- FETCH HOOKING ---

    private hookFetch(): void {
        this.originalFetch = window.fetch;
        const extractor = this;

        window.fetch = async function (...args: any[]) {
            // Parse arguments
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : (resource as Request).url;
            const method = config?.method?.toUpperCase() || 'GET';
            const body = config?.body;

            // Call original fetch
            const response = await extractor.originalFetch.apply(this, args);

            // Clone response to read data without disturbing the stream
            const clone = response.clone();
            clone.text().then((text: string) => {
                extractor.handleNetworkRequest(url, method, body, text);
            }).catch(() => {
                // Silently ignore errors in reading response
            });

            return response;
        };
    }

    private restoreFetch(): void {
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
        }
    }

    // --- REQUEST HANDLING ---

    /**
     * Handle intercepted network request
     * Match against rules and extract data
     */
    private handleNetworkRequest(
        url: string,
        method: string,
        reqBody: any,
        resBody: any
    ): void {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules) return;

        const reqData = this.safeParse(reqBody);
        const resData = this.safeParse(resBody);

        const networkContext: NetworkContext = {
            reqBody: reqData,
            resBody: resData,
            method: method,
            url: url
        };

        // Match against each tracking rule
        for (const rule of this.trackerConfig.trackingRules) {
            if (!rule.payloadMappings) continue;

            // Filter mappings that match this request
            const applicableMappings = rule.payloadMappings.filter((mapping: any) => {
                if (!mapping.requestUrlPattern) return false;

                // Check method match
                if (mapping.requestMethod && 
                    mapping.requestMethod.toUpperCase() !== method.toUpperCase()) {
                    return false;
                }

                // Check URL pattern match
                if (!PathMatcher.matchStaticSegments(url, mapping.requestUrlPattern)) {
                    return false;
                }
                if (!PathMatcher.match(url, mapping.requestUrlPattern)) {
                    return false;
                }

                return true;
            });

            if (applicableMappings.length > 0) {
                // Extract data from matched mappings
                const extractedData: Record<string, any> = {};

                for (const mapping of applicableMappings) {
                    const normalizedMapping = {
                        ...mapping,
                        source: 'network_request',
                        value: mapping.value || mapping.requestBodyPath
                    };

                    const value = this.extract(normalizedMapping, networkContext);
                    if (this.isValid(value)) {
                        extractedData[mapping.field] = value;
                    }
                }

                // If we extracted any data, invoke callback
                if (Object.keys(extractedData).length > 0) {
                    if (this.onNetworkMatchCallback) {
                        this.onNetworkMatchCallback(rule, extractedData, networkContext);
                    }

                    // Log for debugging
                    console.groupCollapsed(
                        `%c[NetworkExtractor] Match: ${method} ${url}`,
                        'color: orange'
                    );
                    console.log('Rule:', rule.name);
                    console.log('Extracted:', extractedData);
                    console.groupEnd();
                }
            }
        }
    }

    // --- HELPER METHODS ---

    private matchesUrl(url: string, pattern: string): boolean {
        return PathMatcher.match(url, pattern);
    }

    private traverseObject(obj: any, path: string): any {
        if (!obj) return null;
        try {
            const keys = path.split('.');
            let current = obj;
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return null;
                }
            }
            return (typeof current === 'object') ? JSON.stringify(current) : current;
        } catch {
            return null;
        }
    }

    private safeParse(data: any): any {
        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch {
            return data;
        }
    }

    private isValid(val: any): boolean {
        return val !== null && val !== undefined && val !== '';
    }
}
