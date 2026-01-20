/**
 * SearchKeywordPlugin - Search Keyword Tracking
 *
 * 1. Lấy search keyword configuration từ tracker config
 * 2. Theo dõi input events trên input selector
 * 3. Log search keyword khi người dùng nhập (với debounce)
 *
 * FLOW:
 * init → get config from tracker → attach listeners → log keywords
 */
import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class SearchKeywordPlugin extends BasePlugin {
    readonly name = "SearchKeywordPlugin";
    private inputElement;
    private handleInputBound;
    private handleKeyPressBound;
    private debounceTimer;
    private readonly debounceDelay;
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
     * Handle input event - log với debounce 400ms
     */
    private handleInput;
    /**
     * Handle keypress event - log khi user nhấn Enter (không debounce)
     */
    private handleKeyPress;
}
//# sourceMappingURL=search-keyword-plugin.d.ts.map