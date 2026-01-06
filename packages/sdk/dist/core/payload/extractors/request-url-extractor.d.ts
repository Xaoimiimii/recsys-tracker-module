import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
export declare class RequestUrlExtractor implements IPayloadExtractor {
    private history;
    private readonly MAX_HISTORY;
    private isTrackingActive;
    private originalXmlOpen;
    private originalXmlSend;
    private originalFetch;
    private payloadBuilder;
    /**
     * NEW: Set reference to PayloadBuilder
     */
    setPayloadBuilder(builder: any): void;
    /**
     * NEW FLOW: Extract data from the most recent matching network request
     * Chỉ tìm requests xảy ra SAU trigger trong window 5s
     */
    extract(mapping: PayloadMapping, _context?: any): any;
    private extractValueFromUrl;
    /**
     * Enable network tracking
     */
    enableTracking(): void;
    /**
     * Disable network tracking
     */
    disableTracking(): void;
    private hookXhr;
    private restoreXhr;
    private hookFetch;
    private restoreFetch;
    private addToHistory;
}
//# sourceMappingURL=request-url-extractor.d.ts.map