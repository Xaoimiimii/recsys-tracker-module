import { IPlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class PluginManager {
    private plugins;
    private tracker;
    constructor(tracker: RecSysTracker);
    register(plugin: IPlugin): void;
    /**
     * Unregister a plugin
     */
    unregister(pluginName: string): boolean;
    /**
     * Start a specific plugin
     */
    start(pluginName: string): boolean;
    /**
     * Stop a specific plugin
     */
    stop(pluginName: string): boolean;
    /**
     * Start all registered plugins
     */
    startAll(): void;
    /**
     * Stop all registered plugins
     */
    stopAll(): void;
    /**
     * Get a plugin by name
     */
    get(pluginName: string): IPlugin | undefined;
    /**
     * Check if a plugin is registered
     */
    has(pluginName: string): boolean;
    /**
     * Get all registered plugin names
     */
    getPluginNames(): string[];
    /**
     * Get plugin status
     */
    getStatus(): {
        name: string;
        version: string;
        active: boolean;
    }[];
    /**
     * Destroy all plugins and cleanup
     */
    destroy(): void;
}
//# sourceMappingURL=plugin-manager.d.ts.map