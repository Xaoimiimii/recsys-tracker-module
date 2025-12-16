import { ICondition } from '../interfaces/recsys-rule.interface';
export declare const STORAGE_KEYS: {
    ANON_USER_ID: string;
    USER_ID: string;
    SESSION_ID: string;
    IDENTIFIERS: string;
    LAST_USER_ID: string;
};
export declare const DEBUG = false;
export declare function log(...args: any[]): void;
export declare function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void;
export declare function checkRuleCondition(url: string, condition: ICondition): boolean;
export declare const CUSTOM_ROUTE_EVENT = "recsys_route_change";
export declare function setupSPARouterWrapper(): void;
//# sourceMappingURL=plugin-utils.d.ts.map