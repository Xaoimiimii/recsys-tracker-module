import { DisplayManager, PluginManager } from './core';
import { TrackerConfig } from './types';
export declare class RecSysTracker {
    private configLoader;
    private errorBoundary;
    private eventBuffer;
    private eventDispatcher;
    private metadataNormalizer;
    private displayManager;
    private pluginManager;
    private config;
    private userId;
    private isInitialized;
    private sendInterval;
    constructor();
    init(): Promise<void>;
    private autoInitializePlugins;
    track(eventData: {
        triggerTypeId: number;
        userId: number;
        itemId: number;
        rate?: {
            Value: number;
            Review: string;
        };
    }): void;
    private setupBatchSending;
    private sendBatch;
    private setupUnloadHandler;
    flush(): Promise<void>;
    getConfig(): TrackerConfig | null;
    setUserId(userId: string | null): void;
    getUserId(): string | null;
    destroy(): void;
    getPluginManager(): PluginManager;
    getDisplayManager(): DisplayManager | null;
    use(plugin: any): this;
    startPlugins(): void;
    stopPlugins(): void;
}
export default RecSysTracker;
export { ConfigLoader, PluginManager, DisplayManager } from './core';
export { IPlugin, BasePlugin } from './core/plugins/base-plugin';
export { ClickPlugin } from './core/plugins/click-plugin';
export { PageViewPlugin } from './core/plugins/page-view-plugin';
export { FormPlugin } from './core/plugins/form-plugin';
export type * from './types';
//# sourceMappingURL=index.d.ts.map