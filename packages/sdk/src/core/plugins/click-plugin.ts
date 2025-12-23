import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { IRecsysContext } from './interfaces/recsys-context.interface';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { throttle } from './utils/plugin-utils';

export class ClickPlugin extends BasePlugin {
    public readonly name = 'ClickPlugin';
    
    private context: IRecsysContext | null = null;
    private detector: AIItemDetector | null = null; 
    private throttledHandler: (event: MouseEvent) => void;
    private readonly THROTTLE_DELAY = 300;

    constructor() {
        super();
        // Wrap handler với error boundary ngay trong constructor
        this.throttledHandler = throttle(
            this.wrapHandler(this.handleDocumentClick.bind(this), 'handleDocumentClick'),
            this.THROTTLE_DELAY
        );
    }

    public init(tracker: RecSysTracker): void {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            
            this.context = new TrackerContextAdapter(tracker);
            this.detector = getAIItemDetector(); 
            console.log(`[ClickPlugin] initialized for Rule + AI-based tracking.`);
        }, 'ClickPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;
            
            if (this.context && this.detector) {
                document.addEventListener("click", this.throttledHandler as any, false); 
                console.log("[ClickPlugin] started Rule + AI-based listening (Throttled).");
                this.active = true;
            }
        }, 'ClickPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            document.removeEventListener("click", this.throttledHandler as any, false);
            super.stop();
        }, 'ClickPlugin.stop');
    }

    private handleDocumentClick(event: MouseEvent): void {
        if (!this.context || !this.detector) return;

        const clickRules = this.context.config.getRules(1); // triggerEventId = 1 for click
        if (clickRules.length === 0) {
            return;
        }

        // Loop qua tất cả click rules và check match
        for (const rule of clickRules) {
            const selector = rule.trackingTarget.value;
            if (!selector) continue;

            const matchedElement = (event.target as Element).closest(selector);

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
