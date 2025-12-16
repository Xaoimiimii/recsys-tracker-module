import { IPlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class PluginManager {
    private plugins;
    private tracker;
    private errorBoundary;
    constructor(tracker: RecSysTracker);
    register(plugin: IPlugin): void;
    unregister(pluginName: string): boolean;
    start(pluginName: string): boolean;
    stop(pluginName: string): boolean;
    startAll(): void;
    stopAll(): void;
    get(pluginName: string): IPlugin | undefined;
    has(pluginName: string): boolean;
    getPluginNames(): string[];
    getStatus(): {
        name: string;
        active: boolean;
    }[];
    destroy(): void;
}
//# sourceMappingURL=plugin-manager.d.ts.map