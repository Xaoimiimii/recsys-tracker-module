import { TrackingRule } from '../types';
export declare class TrackerInit {
    private static usernameCache;
    static getUsername(): string;
    static init(): void;
    static handleMapping(rule: TrackingRule, target?: HTMLElement | null): Record<string, any>;
    static checkConditions(conditions: any[]): boolean;
}
//# sourceMappingURL=tracker-init.d.ts.map