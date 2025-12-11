import { ReturnMethod } from '../../types';
export declare class DisplayManager {
    private popupDisplay;
    private inlineDisplay;
    private domainKey;
    private apiBaseUrl;
    constructor(domainKey: string, apiBaseUrl?: string);
    initialize(returnMethods: ReturnMethod[]): void;
    private activateDisplayMethod;
    private initializePopup;
    private initializeInline;
    destroy(): void;
}
//# sourceMappingURL=display-manager.d.ts.map