import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class SearchKeywordPlugin extends BasePlugin {
    readonly name = "SearchKeywordPlugin";
    private inputElements;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    /**
     * Attach event listeners to input element
     */
    private attachListeners;
    /**
     * Find input element with fallback strategies
     * 1. Direct querySelector
     * 2. Find element with class containing selector, then find input inside
     * 3. Find element with class containing selector, check if it's an input
     */
    private findInputElement;
    /**
     * Add event listeners to input element
     */
    private addEventListeners;
    /**
     * Remove event listeners
     */
    private removeListeners;
    /**
     * Remove listener cho một config cụ thể
     */
    private removeListener;
    /**
     * Handle keypress event - log khi user nhấn Enter (không debounce)
     */
    private handleKeyPress;
    /**
     * Trigger push keyword API (được gọi khi nhấn Enter hoặc từ DisplayManager)
     */
    private triggerPushKeyword;
    /**
     * Call API POST recommendation/push-keyword
     */
    pushKeywordToServer(userId: string, anonymousId: string, domainKey: string, keyword: string): Promise<void>;
}
//# sourceMappingURL=search-keyword-plugin.d.ts.map