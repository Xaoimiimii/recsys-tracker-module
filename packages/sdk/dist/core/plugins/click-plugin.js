import { BasePlugin } from './base-plugin';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector } from './utils/ai-item-detector';
import { throttle } from './utils/plugin-utils';
export class ClickPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'ClickPlugin';
        this.context = null;
        this.detector = null;
        this.THROTTLE_DELAY = 300;
        // Wrap handler với error boundary ngay trong constructor
        this.throttledHandler = throttle(this.wrapHandler(this.handleDocumentClick.bind(this), 'handleDocumentClick'), this.THROTTLE_DELAY);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.context = new TrackerContextAdapter(tracker);
            this.detector = getAIItemDetector();
            console.log(`[ClickPlugin] initialized for Rule + AI-based tracking.`);
        }, 'ClickPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            if (this.context && this.detector) {
                document.addEventListener("click", this.throttledHandler, false);
                console.log("[ClickPlugin] started Rule + AI-based listening (Throttled).");
                this.active = true;
            }
        }, 'ClickPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            document.removeEventListener("click", this.throttledHandler, false);
            super.stop();
        }, 'ClickPlugin.stop');
    }
    handleDocumentClick(event) {
        if (!this.context || !this.detector || !this.tracker)
            return;
        const eventId = this.tracker.getEventTypeId('Click');
        if (!eventId)
            return;
        const clickRules = this.context.config.getRules(eventId);
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
                const payload = this.context.payloadBuilder.build(matchedElement, rule);
                this.context.eventBuffer.enqueue(payload);
                // Stop after first match (hoặc có thể tiếp tục nếu muốn track nhiều rules)
                break;
            }
        }
    }
}
//# sourceMappingURL=click-plugin.js.map