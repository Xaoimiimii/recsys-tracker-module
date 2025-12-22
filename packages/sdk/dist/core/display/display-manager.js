import { PopupDisplay } from './popup-display';
import { InlineDisplay } from './inline-display';
export class DisplayManager {
    constructor(domainKey, apiBaseUrl = 'http://localhost:3000') {
        this.popupDisplay = null;
        this.inlineDisplay = null;
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
    }
    // Khởi tạo display methods dựa trên config
    initialize(returnMethods) {
        if (!returnMethods || returnMethods.length === 0) {
            console.log('[DisplayManager] No return methods configured');
            return;
        }
        returnMethods.forEach(method => {
            this.activateDisplayMethod(method);
        });
    }
    // Kích hoạt display method tương ứng
    activateDisplayMethod(method) {
        const { returnMethodId, configurationName, value } = method;
        switch (returnMethodId) {
            case 1: // Popup
                this.initializePopup(configurationName, value);
                break;
            case 2: // Inline
                this.initializeInline(configurationName, value);
                break;
            default:
                console.warn(`[DisplayManager] Unknown returnMethodId: ${returnMethodId}`);
        }
    }
    // Khởi tạo Popup Display
    initializePopup(slotName, config) {
        try {
            // Parse config nếu là JSON string, nếu không thì dùng default
            let popupConfig = {};
            if (config) {
                try {
                    popupConfig = JSON.parse(config);
                }
                catch {
                    popupConfig = {};
                }
            }
            this.popupDisplay = new PopupDisplay(this.domainKey, slotName, this.apiBaseUrl, popupConfig);
            this.popupDisplay.start();
            console.log(`[DisplayManager] Popup initialized for slot: ${slotName}`);
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing popup:', error);
        }
    }
    // Khởi tạo Inline Display
    initializeInline(slotName, selector) {
        try {
            if (!selector) {
                console.warn('[DisplayManager] Inline display requires a selector');
                return;
            }
            this.inlineDisplay = new InlineDisplay(this.domainKey, slotName, selector, this.apiBaseUrl);
            this.inlineDisplay.start();
            console.log(`[DisplayManager] Inline initialized for slot: ${slotName}, selector: ${selector}`);
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing inline:', error);
        }
    }
    // Dừng tất cả display methods
    destroy() {
        if (this.popupDisplay) {
            this.popupDisplay.stop();
            this.popupDisplay = null;
        }
        if (this.inlineDisplay) {
            this.inlineDisplay.stop();
            this.inlineDisplay = null;
        }
    }
}
//# sourceMappingURL=display-manager.js.map