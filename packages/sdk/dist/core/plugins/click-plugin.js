// Click Plugin - 100% Original Logic with BasePlugin wrapper
import { BasePlugin } from './base-plugin';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector } from './utils/ai-item-detector';
import { throttle } from './utils/plugin-utils';
export class ClickPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'ClickPlugin';
        this.version = '1.0.0';
        // Original plugin state
        this.context = null;
        this.detector = null;
        this.THROTTLE_DELAY = 300;
        this.throttledHandler = throttle(this.handleDocumentClick.bind(this), this.THROTTLE_DELAY);
    }
    // BasePlugin integration
    init(tracker) {
        super.init(tracker);
        // Original init logic
        this.context = new TrackerContextAdapter(tracker);
        this.detector = getAIItemDetector();
        console.log(`[ClickPlugin] initialized for Rule + AI-based tracking.`);
    }
    start() {
        if (!this.ensureInitialized())
            return;
        // Original start logic
        if (this.context && this.detector) {
            document.addEventListener("click", this.throttledHandler, false);
            console.log("[ClickPlugin] started Rule + AI-based listening (Throttled).");
            this.active = true;
        }
    }
    stop() {
        document.removeEventListener("click", this.throttledHandler, false);
        super.stop();
    }
    // Original logic - 100% preserved
    handleDocumentClick(event) {
        if (!this.context || !this.detector)
            return;
        try {
            const clickRules = this.context.config.getRules('click');
            if (clickRules.length === 0) {
                return;
            }
            const rule = clickRules[0];
            const selector = rule.targetSelector;
            const matchedElement = event.target.closest(selector);
            if (matchedElement) {
                const payload = this.context.payloadBuilder.build(matchedElement, rule);
                this.context.eventBuffer.enqueue(payload);
            }
        }
        catch (error) {
            console.error(`[ClickPlugin Error] Error during Rule processing or Payload building:`, error);
        }
    }
}
//# sourceMappingURL=click-plugin.js.map