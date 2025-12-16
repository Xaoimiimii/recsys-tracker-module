// Page View Plugin - 100% Original Logic with BasePlugin wrapper
import { BasePlugin } from './base-plugin';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector } from './utils/ai-item-detector';
import { CUSTOM_ROUTE_EVENT } from './utils/plugin-utils';
export class PageViewPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'PageViewPlugin';
        this.version = '1.0.0';
        // Original plugin state
        this.context = null;
        this.detector = null;
    }
    // BasePlugin integration
    init(tracker) {
        super.init(tracker);
        // Original init logic
        this.context = new TrackerContextAdapter(tracker);
        this.detector = getAIItemDetector();
        console.log(`[PageViewPlugin] initialized for Rule + AI tracking.`);
    }
    start() {
        if (!this.ensureInitialized())
            return;
        // Original start logic
        if (!this.context || !this.detector)
            return;
        window.addEventListener("popstate", this.handlePageChange.bind(this));
        if (typeof CUSTOM_ROUTE_EVENT !== 'undefined') {
            window.addEventListener(CUSTOM_ROUTE_EVENT, this.handlePageChange.bind(this));
        }
        this.trackCurrentPage(window.location.href);
        console.log("[PageViewPlugin] started listening and tracked initial load.");
        this.active = true;
    }
    stop() {
        window.removeEventListener("popstate", this.handlePageChange.bind(this));
        if (typeof CUSTOM_ROUTE_EVENT !== 'undefined') {
            window.removeEventListener(CUSTOM_ROUTE_EVENT, this.handlePageChange.bind(this));
        }
        super.stop();
    }
    // Original logic - 100% preserved
    handlePageChange() {
        setTimeout(() => {
            this.trackCurrentPage(window.location.href);
        }, 0);
    }
    trackCurrentPage(currentUrl) {
        if (!this.context || !this.detector)
            return;
        const urlObject = new URL(currentUrl);
        const pathname = urlObject.pathname;
        try {
            const pageViewRules = this.context.config.getRules('page_view');
            const defaultAiRule = pageViewRules.find(r => r.payloadExtractor.source === 'ai_detect' && r.targetSelector === 'body');
            let matchFoundInSpecificRule = false;
            for (const rule of pageViewRules) {
                if (rule === defaultAiRule)
                    continue;
                let matchFound = false;
                let matchData = null;
                const selector = rule.targetSelector;
                if (rule.payloadExtractor.source === 'regex_group' && selector && selector.startsWith('^')) {
                    const pattern = new RegExp(selector);
                    const match = pathname.match(pattern);
                    if (match) {
                        matchFound = true;
                        matchData = { regexMatch: match };
                    }
                }
                else if (selector) {
                    if (document.querySelector(selector)) {
                        matchFound = true;
                    }
                }
                if (matchFound) {
                    console.log(`[Recsys Tracker] ✅ Match Specific PageView Rule: ${rule.ruleName}`);
                    let structuredItem = null;
                    if (rule.payloadExtractor.source === 'ai_detect') {
                        structuredItem = this.detector.detectItemFromStructuredData(document.body) ||
                            this.detector.extractOpenGraphData();
                    }
                    const payload = this.context.payloadBuilder.build(structuredItem, rule, matchData || undefined);
                    this.context.eventBuffer.enqueue(payload);
                    matchFoundInSpecificRule = true;
                    return;
                }
            }
            if (!matchFoundInSpecificRule) {
                console.log('[Recsys Tracker] ⏸️ Pageview skipped. No specific rule matched the current URL/DOM.');
                return;
            }
        }
        catch (error) {
            console.error(`[PageViewPlugin Error] Error during tracking:`, error);
        }
    }
}
//# sourceMappingURL=page-view-plugin.js.map