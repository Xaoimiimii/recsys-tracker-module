/**
 * ClickPlugin - UI Trigger Layer
 *
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi click
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG lấy payload, KHÔNG bắt network
 *
 * FLOW:
 * click event → check rules → handleTrigger → DONE
 */
import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ClickPlugin extends BasePlugin {
    readonly name = "ClickPlugin";
    private handleClickBound;
    private lastClickTimestamp;
    private debounceTime;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    /**
     * Handle click event - TRIGGER PHASE
     */
    private handleClick;
    private getElementKey;
    /**
     * Find element matching rule selector
     */
    private findMatchingElement;
    /**
     * Check if element has flexible class match (for CSS modules)
     */
    private hasFlexibleClassMatch;
    /**
     * Find parent with flexible class match
     */
    private findParentWithFlexibleClass;
    /**
     * Check if element is interactive (button, link, etc.)
     */
    private isInteractiveElement;
    /**
     * Dispatch tracking event
     */
    private dispatchEvent;
}
//# sourceMappingURL=click-plugin.d.ts.map