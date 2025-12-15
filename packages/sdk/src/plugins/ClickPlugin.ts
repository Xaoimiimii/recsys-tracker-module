import { IRecsysContext } from '../core/IRecsysContext';
import { getAIItemDetector, AIItemDetector } from '../core/AIItemDetector';
import { throttle } from '../core/utils';

export class ClickPlugin {
    private context: IRecsysContext | null = null;
    private detector: AIItemDetector | null = null; 
    private throttledHandler: (event: MouseEvent) => void;
    private readonly THROTTLE_DELAY = 300;

    constructor() {
        this.throttledHandler = throttle(
            this.handleDocumentClick.bind(this),
            this.THROTTLE_DELAY
        );
    }

    public init(context: IRecsysContext): void {
        this.context = context;
        this.detector = getAIItemDetector(); 
        console.log(`[ClickPlugin] initialized for Rule + AI-based tracking.`);
    }

    public start(): void {
        if (this.context && this.detector) {
            document.addEventListener("click", this.throttledHandler as any, false); 
            console.log("[ClickPlugin] started Rule + AI-based listening (Throttled).");
        }
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