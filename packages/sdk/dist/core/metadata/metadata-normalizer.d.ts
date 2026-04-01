export interface SessionData {
    sessionId: string;
    startTime: number;
    lastActivityTime: number;
}
export interface PageMetadata {
    url: string;
    title: string;
    referrer: string;
    path: string;
    query: Record<string, string>;
}
export interface DeviceMetadata {
    userAgent: string;
    language: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
}
export interface Metadata {
    session: SessionData;
    page: PageMetadata;
    device: DeviceMetadata;
    timestamp: number;
}
export declare class MetadataNormalizer {
    private sessionData;
    private sessionTimeout;
    private sessionStorageKey;
    constructor(sessionTimeout?: number);
    getMetadata(): Metadata;
    private initSession;
    private createNewSession;
    updateSessionActivity(): void;
    /**
     * Get current session data
     */
    getSessionData(): SessionData;
    private saveSession;
    private generateSessionId;
    getPageMetadata(): PageMetadata;
    getDeviceMetadata(): DeviceMetadata;
    generateEventId(): string;
    extractFromUrl(pattern: string, group?: number): string | null;
    extractFromElement(element: Element, attribute: string): string | null;
    resetSession(): void;
}
//# sourceMappingURL=metadata-normalizer.d.ts.map