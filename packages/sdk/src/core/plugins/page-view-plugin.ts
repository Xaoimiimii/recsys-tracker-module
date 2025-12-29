import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { CUSTOM_ROUTE_EVENT } from './utils/plugin-utils';

export class PageViewPlugin extends BasePlugin {
    public readonly name = 'PageViewPlugin';

    private detector: AIItemDetector | null = null;

    public init(tracker: RecSysTracker): void {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.detector = getAIItemDetector();
            console.log(`[PageViewPlugin] initialized.`);
        }, 'PageViewPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;

            const wrappedHandler = this.wrapHandler(this.handlePageChange.bind(this), 'handlePageChange');
            window.addEventListener("popstate", wrappedHandler);
            if (typeof CUSTOM_ROUTE_EVENT !== 'undefined') {
                window.addEventListener(CUSTOM_ROUTE_EVENT, wrappedHandler);
            }

            this.trackCurrentPage(window.location.href);
            console.log("[PageViewPlugin] started listening and tracked initial load.");
            this.active = true;
        }, 'PageViewPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            const wrappedHandler = this.wrapHandler(this.handlePageChange.bind(this), 'handlePageChange');
            window.removeEventListener("popstate", wrappedHandler);
            if (typeof CUSTOM_ROUTE_EVENT !== 'undefined') {
                window.removeEventListener(CUSTOM_ROUTE_EVENT, wrappedHandler);
            }
            super.stop();
        }, 'PageViewPlugin.stop');
    }

    private handlePageChange(): void {
        setTimeout(() => {
            this.trackCurrentPage(window.location.href);
        }, 0);
    }

    private trackCurrentPage(currentUrl: string): void {
        if (!this.tracker || !this.detector) return;

        const urlObject = new URL(currentUrl);
        const pathname = urlObject.pathname;

        const eventId = this.tracker.getEventTypeId('Page View');
        if (!eventId) {
            console.log('[PageViewPlugin] Page View event type not found in config.');
            return;
        }

        const config = this.tracker.getConfig();
        const pageViewRules = config?.trackingRules?.filter(r => r.eventTypeId === eventId);

        if (!pageViewRules || pageViewRules.length === 0) {
            console.log('[PageViewPlugin] No page view rules configured.');
            return;
        }

        // Loop qua tất cả rules và tìm rule phù hợp
        for (const rule of pageViewRules) {
            let matchFound = false;

            const selector = rule.trackingTarget?.value || '';

            // Determine payload extractor logic from rule
            const isRegex = selector.startsWith('^');

            // Regex-based matching (URL pattern)
            if (isRegex) {
                const pattern = new RegExp(selector);
                const match = pathname.match(pattern);

                if (match) {
                    matchFound = true;
                    console.log(`[PageViewPlugin] ✅ Matched regex rule: ${rule.name}`);
                }
            }
            // DOM selector matching (Checking presence of element on page)
            else if (selector && selector !== 'body') {
                if (document.querySelector(selector)) {
                    matchFound = true;
                    console.log(`[PageViewPlugin] ✅ Matched DOM selector rule: ${rule.name}`);
                }
            }
            // Default body matching
            else if (selector === 'body') {
                matchFound = true;
                console.log(`[PageViewPlugin] ✅ Matched default rule: ${rule.name}`);
            }

            if (matchFound) {
                // AI/Structured Data detection context
                const structuredItem = this.detector!.detectItemFromStructuredData(document.body) ||
                    this.detector!.extractOpenGraphData();

                // Use centralized build and track
                this.buildAndTrack(structuredItem, rule, eventId);

                return;
            }
        }

        console.log('[PageViewPlugin] ⏸️ No matching rule found for current URL/DOM.');
    }
}
