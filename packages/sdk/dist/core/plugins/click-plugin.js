import { BasePlugin } from './base-plugin';
import { throttle } from './utils/plugin-utils';
export class ClickPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'ClickPlugin';
        this.THROTTLE_DELAY = 300;
        // Wrap handler với error boundary ngay trong constructor
        this.throttledHandler = throttle(this.wrapHandler(this.handleDocumentClick.bind(this), 'handleDocumentClick'), this.THROTTLE_DELAY);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[ClickPlugin] initialized for Rule.`);
        }, 'ClickPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            if (this.tracker) {
                document.addEventListener("click", this.throttledHandler, false);
                console.log("[ClickPlugin] started listening for Click events.");
                this.active = true;
            }
        }, 'ClickPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('click', this.throttledHandler);
            }
            super.destroy();
        }, 'ClickPlugin.destroy');
    }
    handleDocumentClick(event) {
        if (!this.tracker)
            return;
        const eventId = this.tracker.getEventTypeId('Click');
        if (!eventId)
            return;
        const config = this.tracker.getConfig();
        if (!config || !config.trackingRules)
            return;
        const clickRules = config.trackingRules.filter(r => r.eventTypeId === eventId);
        if (clickRules.length === 0) {
            return;
        }
        // Loop qua tất cả click rules và check match
        for (const rule of clickRules) {
            const selector = rule.trackingTarget.value;
            if (!selector)
                continue;
            const matchedElement = event.target.closest(selector);
            if (matchedElement) {
                console.log(`[ClickPlugin] Matched rule: ${rule.name}`);
                // Use centralized build and track
                this.buildAndTrack(matchedElement, rule, eventId);
                // Stop after first match
                break;
            }
        }
    }
}
//# sourceMappingURL=click-plugin.js.map