import { TrackedEvent } from './event-buffer';
export type SendStrategy = 'beacon' | 'fetch';
export interface DispatchOptions {
    endpoint: string;
    domainUrl?: string;
    timeout?: number;
    headers?: Record<string, string>;
}
export declare class EventDispatcher {
    private endpoint;
    private domainUrl;
    private timeout;
    private headers;
    constructor(options: DispatchOptions);
    send(event: TrackedEvent): Promise<boolean>;
    sendBatch(events: TrackedEvent[]): Promise<boolean>;
    private sendWithStrategy;
    private sendBeacon;
    private sendFetch;
    setEndpoint(endpoint: string): void;
    setDomainUrl(domainUrl: string): void;
    setTimeout(timeout: number): void;
    setHeaders(headers: Record<string, string>): void;
}
//# sourceMappingURL=event-dispatcher.d.ts.map