import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { throttle } from './utils/plugin-utils';

export class ClickPlugin extends BasePlugin {
    public readonly name = 'ClickPlugin';

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
            console.log(`[ClickPlugin] initialized for Rule.`);
        }, 'ClickPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;

            if (this.tracker) {
                document.addEventListener("click", this.throttledHandler as any, false);
                console.log("[ClickPlugin] started Rule-based listening (Throttled).");
                this.active = true;
            }
        }, 'ClickPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('click', this.throttledHandler);
            }
            super.destroy();
        }, 'ClickPlugin.destroy');
    }

    private handleDocumentClick(event: MouseEvent): void {
        if (!this.tracker) return;

        const eventId = this.tracker.getEventTypeId('Click');
        if (!eventId) return;

        const config = this.tracker.getConfig();
        if (!config || !config.trackingRules) return;

        const clickRules = config.trackingRules.filter(r => r.eventTypeId === eventId);
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

                // Use centralized build and track
                this.buildAndTrack(matchedElement, rule, eventId);

                // Stop after first match
                break;
            }
        }
    }
}
