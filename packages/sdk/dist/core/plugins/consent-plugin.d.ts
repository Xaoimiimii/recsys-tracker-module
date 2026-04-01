import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ConsentPlugin extends BasePlugin {
    readonly name = "ConsentPlugin";
    private readonly storageKey;
    private bannerId;
    private currentLangCode;
    private langObserver;
    init(tracker: RecSysTracker): void;
    start(): void;
    private detectLanguage;
    private t;
    private setupLanguageObserver;
    private updateBannerText;
    private renderBanner;
    private removeBanner;
    stop(): void;
}
//# sourceMappingURL=consent-plugin.d.ts.map