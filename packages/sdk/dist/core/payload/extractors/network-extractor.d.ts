import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
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
export declare class NetworkExtractor implements IPayloadExtractor {
    private originalXmlOpen;
    private originalXmlSend;
    private originalFetch;
    private isTrackingActive;
    private trackerConfig;
    private onNetworkMatchCallback?;
    /**
     * Extract data from network request/response based on mapping
     * This is called by PayloadBuilder when processing network_request mappings
     */
    extract(mapping: PayloadMapping, context?: any): any;
    /**
     * Enable network tracking by hooking into XHR and Fetch APIs
     */
    enableTracking(config: any, onMatch?: (rule: any, data: any, context: NetworkContext) => void): void;
    /**
     * Disable network tracking and restore original XHR/Fetch
     */
    disableTracking(): void;
    /**
     * Check if network tracking is currently active
     */
    isTracking(): boolean;
    private hookXhr;
    private restoreXhr;
    private hookFetch;
    private restoreFetch;
    /**
     * Handle intercepted network request
     * Match against rules and extract data
     */
    private handleNetworkRequest;
    private matchesUrl;
    private traverseObject;
    private safeParse;
    private isValid;
}
//# sourceMappingURL=network-extractor.d.ts.map