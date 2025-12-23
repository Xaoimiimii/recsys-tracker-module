import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { IRecsysContext, IAIItemDetectionResult } from './interfaces/recsys-context.interface';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { CUSTOM_ROUTE_EVENT } from './utils/plugin-utils';

export class PageViewPlugin extends BasePlugin {
    public readonly name = 'PageViewPlugin';
    
    private context: IRecsysContext | null = null;
    private detector: AIItemDetector | null = null; 

    public init(tracker: RecSysTracker): void {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            
            this.context = new TrackerContextAdapter(tracker);
            this.detector = getAIItemDetector();
            console.log(`[PageViewPlugin] initialized for Rule + AI tracking.`);
        }, 'PageViewPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;
            
            if (!this.context || !this.detector) return;

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
        if (!this.context || !this.detector) return;
        
        const urlObject = new URL(currentUrl);
        const pathname = urlObject.pathname;

        const pageViewRules = this.context.config.getRules(3); // triggerEventId = 3 for page_view
        
        if (pageViewRules.length === 0) {
            console.log('[PageViewPlugin] No page view rules configured.');
            return;
        }
        
        // Loop qua tất cả rules và tìm rule phù hợp
        for (const rule of pageViewRules) {
            let matchFound = false;
            let matchData = null;
            const selector = rule.trackingTarget?.value || '';

            // Determine payload extractor from rule data
            const isRegex = selector.startsWith('^');
            const extractorSource = isRegex ? 'regex_group' : 'ai_detect';

            // Regex-based matching (URL pattern)
            if (extractorSource === 'regex_group' && selector && selector.startsWith('^')) {
                const pattern = new RegExp(selector);
                const match = pathname.match(pattern);
                
                if (match) {
                    matchFound = true;
                    matchData = { regexMatch: match };
                    console.log(`[PageViewPlugin] ✅ Matched regex rule: ${rule.name}`);
                }
            } 
            // DOM selector matching
            else if (selector && selector !== 'body') {
                if (document.querySelector(selector)) {
                    matchFound = true;
                    console.log(`[PageViewPlugin] ✅ Matched DOM selector rule: ${rule.name}`);
                }
            }
            // Default body matching with AI
            else if (selector === 'body' && extractorSource === 'ai_detect') {
                matchFound = true;
                console.log(`[PageViewPlugin] ✅ Matched default AI rule: ${rule.name}`);
            }
            
            if (matchFound) {
                let structuredItem: IAIItemDetectionResult | null = null;
                
                // AI detection if needed
                if (extractorSource === 'ai_detect') {
                    structuredItem = this.detector!.detectItemFromStructuredData(document.body) ||
                                       this.detector!.extractOpenGraphData() as IAIItemDetectionResult | null;
                }
                
                const payload = this.context.payloadBuilder.build(structuredItem, rule, matchData || undefined);
                this.context.eventBuffer.enqueue(payload);
                
                // Stop after first match (hoặc tiếp tục nếu muốn track nhiều rules)
                return;
            }
        }
        
        console.log('[PageViewPlugin] ⏸️ No matching rule found for current URL/DOM.');
    }
}
