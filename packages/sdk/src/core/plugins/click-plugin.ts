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
        this.throttledHandler = throttle(
            this.handleDocumentClick.bind(this),
            this.THROTTLE_DELAY
        );
    }

    public init(tracker: RecSysTracker): void {
        super.init(tracker);
        
        this.context = new TrackerContextAdapter(tracker);
        this.detector = getAIItemDetector(); 
        console.log(`[ClickPlugin] initialized for Rule + AI-based tracking.`);
    }

    public start(): void {
        if (!this.ensureInitialized()) return;
        
        if (this.context && this.detector) {
            document.addEventListener("click", this.throttledHandler as any, false); 
            console.log("[ClickPlugin] started Rule + AI-based listening (Throttled).");
            this.active = true;
        }
    }

    public stop(): void {
        document.removeEventListener("click", this.throttledHandler as any, false);
        super.stop();
    }

    private handleDocumentClick(event: MouseEvent): void {
        if (!this.context || !this.detector) return;

        try {
            const clickRules = this.context.config.getRules('click');
            if (clickRules.length === 0) {
                return;
            }

            const rule = clickRules[0]; 
            const selector = rule.targetSelector; 

            const matchedElement = (event.target as Element).closest(selector);

            if (matchedElement) {
                const payload = this.context.payloadBuilder.build(matchedElement, rule); 
                this.context.eventBuffer.enqueue(payload);
            }

        } catch (error) {
            console.error(
                `[ClickPlugin Error] Error during Rule processing or Payload building:`,
                error
            );
        }
    }
}
