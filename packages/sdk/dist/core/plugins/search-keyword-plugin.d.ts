import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class SearchKeywordPlugin extends BasePlugin {
    readonly name = "SearchKeywordPlugin";
    private inputElement;
    private handleSubmitBound;
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
     * Handle submit event - call API when user presses Enter
     */
    private handleSubmit;
    /**
     * Call API POST recommendation/push-keyword
     */
    private pushKeywordToServer;
}
//# sourceMappingURL=search-keyword-plugin.d.ts.map