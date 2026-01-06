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
    private onNetworkMatchCallback?: (rule: any, extractedData: any, context: NetworkContext) => void;
    private payloadBuilder: any = null; // Reference to PayloadBuilder

    /**
     * NEW: Set reference to PayloadBuilder
     */
    public setPayloadBuilder(builder: any): void {
        this.payloadBuilder = builder;
    }

    /**
     * Extract data from network request/response based on mapping
     * This is called by PayloadBuilder when processing network_request mappings
     */
    extract(mapping: PayloadMapping, context?: any): any {
        if (!context) return null;

        // Validate Context Type mapping if needed, or assume caller provides correct context
        // Check if mapping matches context URL (basic validation)
        if (mapping.requestUrlPattern && context.url) {
            if (!this.matchesUrl(context.url, mapping.requestUrlPattern)) {
                return null;
            }
        }

        const source = (mapping.source || '').toLowerCase();
        const path = mapping.value || mapping.requestBodyPath; // Backward compat or direct value

        if (!path) return null;

        if (source === 'requestbody' || source === 'request_body') {
            return this.traverseObject(context.reqBody, path);
        }

        if (source === 'responsebody' || source === 'response_body') {
            return this.traverseObject(context.resBody, path);
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
    public enableTracking(_config: any, onMatch?: (rule: any, data: any, context: NetworkContext) => void): void {
        if (this.isTrackingActive) {
            console.warn('[NetworkExtractor] Network tracking is already active');
            return;
        }

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
     * NEW FLOW: Handle intercepted network request
     * Chỉ bắt request khi có pending collection + anti-duplicate
     */
    private handleNetworkRequest(
        url: string,
        method: string,
        reqBody: any,
        resBody: any
    ): void {
        if (!this.payloadBuilder || !this.payloadBuilder.pendingCollections) {
            // Không có pending collections → Ignore
            return;
        }

        const timestamp = Date.now();
        const reqData = this.safeParse(reqBody);
        const resData = this.safeParse(resBody);

        const networkContext: NetworkContext = {
            reqBody: reqData,
            resBody: resData,
            method: method,
            url: url
        };

        console.log('[NetworkExtractor] Intercepted request:', method, url);
        console.log('[NetworkExtractor] Pending collections:', this.payloadBuilder.pendingCollections.size);

        // Lặp qua các pending collections
        for (const [ruleId, pending] of this.payloadBuilder.pendingCollections) {
            console.log('[NetworkExtractor] Checking pending rule:', ruleId, pending.rule.name);
            
            // 1. Check xem request có xảy ra SAU trigger không (trong 5s)
            const timeSinceTrigger = timestamp - pending.timestamp;
            if (timeSinceTrigger > 5000) {
                console.log('[NetworkExtractor] Request too late (>5s) for rule:', ruleId);
                continue;
            }
            
            if (timeSinceTrigger < 0) {
                console.log('[NetworkExtractor] Request before trigger for rule:', ruleId);
                continue;
            }
            
            // 2. Check xem đã bắt request cho rule này chưa (anti-duplicate)
            if (pending.networkCaptured) {
                console.log('[NetworkExtractor] Already captured network data for rule:', ruleId, '- IGNORING duplicate');
                continue;
            }
            
            // 3. Check xem request có khớp với rule không
            const matchedMappings = pending.rule.payloadMappings?.filter((mapping: any) => {
                const source = (mapping.source || '').toLowerCase();
                if (!['requestbody', 'request_body', 'responsebody', 'response_body'].includes(source)) {
                    return false;
                }
                
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
            
            if (!matchedMappings || matchedMappings.length === 0) {
                console.log('[NetworkExtractor] Request URL does not match rule patterns');
                continue;
            }
            
            console.log('[NetworkExtractor] ✅ Request matched!', matchedMappings.length, 'mappings');
            
            // 4. Validate xem request có chứa dữ liệu cần thiết không
            let hasRequiredData = false;
            const extractedData: Record<string, any> = {};
            
            for (const mapping of matchedMappings) {
                const normalizedMapping = {
                    ...mapping,
                    source: 'network_request',
                    value: mapping.value || mapping.requestBodyPath
                };

                const value = this.extract(normalizedMapping, networkContext);
                if (this.isValid(value)) {
                    extractedData[mapping.field] = value;
                    hasRequiredData = true;
                }
            }
            
            if (!hasRequiredData) {
                console.log('[NetworkExtractor] Request missing required data, continuing to wait...');
                continue;
            }
            
            // ✅ Đã bắt được request đúng!
            console.log('[NetworkExtractor] 🎯 Captured matching request for rule:', ruleId);
            console.log('[NetworkExtractor] Extracted data:', extractedData);
            
            // Notify PayloadBuilder về dữ liệu mới
            for (const [field, value] of Object.entries(extractedData)) {
                this.payloadBuilder.notifyNetworkData(ruleId, field, value);
            }
            
            // Invoke callback if exists
            if (this.onNetworkMatchCallback) {
                this.onNetworkMatchCallback(pending.rule, extractedData, networkContext);
            }
            
            // Log for debugging
            console.groupCollapsed(
                `%c[NetworkExtractor] ✅ Captured: ${method} ${url}`,
                'color: green; font-weight: bold'
            );
            console.log('Rule:', pending.rule.name);
            console.log('Time since trigger:', timeSinceTrigger, 'ms');
            console.log('Extracted:', extractedData);
            console.groupEnd();
            
            // IMPORTANT: Sau khi bắt được → Đánh dấu đã capture
            // Các requests tiếp theo sẽ bị ignore
            break;
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
