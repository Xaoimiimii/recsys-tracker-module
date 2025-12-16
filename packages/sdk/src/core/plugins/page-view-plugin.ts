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
        super.init(tracker);
        
        this.context = new TrackerContextAdapter(tracker);
        this.detector = getAIItemDetector();
        console.log(`[PageViewPlugin] initialized for Rule + AI tracking.`);
    }

    public start(): void {
        if (!this.ensureInitialized()) return;
        
        if (!this.context || !this.detector) return;

        window.addEventListener("popstate", this.handlePageChange.bind(this));
        if (typeof CUSTOM_ROUTE_EVENT !== 'undefined') {
             window.addEventListener(
                 CUSTOM_ROUTE_EVENT,
                 this.handlePageChange.bind(this)
             );
        }

        this.trackCurrentPage(window.location.href);
        console.log("[PageViewPlugin] started listening and tracked initial load.");
        this.active = true;
    }

    public stop(): void {
        window.removeEventListener("popstate", this.handlePageChange.bind(this));
        if (typeof CUSTOM_ROUTE_EVENT !== 'undefined') {
            window.removeEventListener(CUSTOM_ROUTE_EVENT, this.handlePageChange.bind(this));
        }
        super.stop();
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

        try {
            const pageViewRules = this.context.config.getRules('page_view');
            
            const defaultAiRule = pageViewRules.find(r => r.payloadExtractor.source === 'ai_detect' && r.targetSelector === 'body');
            
            let matchFoundInSpecificRule = false;

            for (const rule of pageViewRules) {
                if (rule === defaultAiRule) continue; 
                
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
                    
                    let structuredItem: IAIItemDetectionResult | null = null;
                    
                    if (rule.payloadExtractor.source === 'ai_detect') {
                        structuredItem = this.detector!.detectItemFromStructuredData(document.body) ||
                                           this.detector!.extractOpenGraphData() as IAIItemDetectionResult | null;
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

        } catch (error) {
            console.error(
                `[PageViewPlugin Error] Error during tracking:`,
                error
            );
        }
    }
}
