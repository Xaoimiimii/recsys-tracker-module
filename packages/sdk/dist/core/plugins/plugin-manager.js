export class PluginManager {
    constructor(tracker) {
        this.plugins = new Map();
        this.tracker = tracker;
    }
    // Register a plugin
    register(plugin) {
        if (this.plugins.has(plugin.name)) {
            console.warn(`[PluginManager] Plugin "${plugin.name}" already registered`);
            return;
        }
        try {
            plugin.init(this.tracker);
            this.plugins.set(plugin.name, plugin);
            console.log(`[PluginManager] Registered plugin: ${plugin.name} v${plugin.version}`);
        }
        catch (error) {
            console.error(`[PluginManager] Failed to register plugin "${plugin.name}":`, error);
        }
    }
    /**
     * Unregister a plugin
     */
    unregister(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
            return false;
        }
        try {
            plugin.destroy();
            this.plugins.delete(pluginName);
            console.log(`[PluginManager] Unregistered plugin: ${pluginName}`);
            return true;
        }
        catch (error) {
            console.error(`[PluginManager] Failed to unregister plugin "${pluginName}":`, error);
            return false;
        }
    }
    /**
     * Start a specific plugin
     */
    start(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
            return false;
        }
        try {
            plugin.start();
            return true;
        }
        catch (error) {
            console.error(`[PluginManager] Failed to start plugin "${pluginName}":`, error);
            return false;
        }
    }
    /**
     * Stop a specific plugin
     */
    stop(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
            return false;
        }
        try {
            plugin.stop();
            return true;
        }
        catch (error) {
            console.error(`[PluginManager] Failed to stop plugin "${pluginName}":`, error);
            return false;
        }
    }
    /**
     * Start all registered plugins
     */
    startAll() {
        console.log(`[PluginManager] Starting ${this.plugins.size} plugin(s)...`);
        this.plugins.forEach((plugin, name) => {
            try {
                if (!plugin.isActive()) {
                    plugin.start();
                }
            }
            catch (error) {
                console.error(`[PluginManager] Failed to start plugin "${name}":`, error);
            }
        });
    }
    /**
     * Stop all registered plugins
     */
    stopAll() {
        console.log(`[PluginManager] Stopping ${this.plugins.size} plugin(s)...`);
        this.plugins.forEach((plugin, name) => {
            try {
                if (plugin.isActive()) {
                    plugin.stop();
                }
            }
            catch (error) {
                console.error(`[PluginManager] Failed to stop plugin "${name}":`, error);
            }
        });
    }
    /**
     * Get a plugin by name
     */
    get(pluginName) {
        return this.plugins.get(pluginName);
    }
    /**
     * Check if a plugin is registered
     */
    has(pluginName) {
        return this.plugins.has(pluginName);
    }
    /**
     * Get all registered plugin names
     */
    getPluginNames() {
        return Array.from(this.plugins.keys());
    }
    /**
     * Get plugin status
     */
    getStatus() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            version: plugin.version,
            active: plugin.isActive(),
        }));
    }
    /**
     * Destroy all plugins and cleanup
     */
    destroy() {
        console.log(`[PluginManager] Destroying ${this.plugins.size} plugin(s)...`);
        this.plugins.forEach((plugin, name) => {
            try {
                plugin.destroy();
            }
            catch (error) {
                console.error(`[PluginManager] Failed to destroy plugin "${name}":`, error);
            }
        });
        this.plugins.clear();
    }
}
//# sourceMappingURL=plugin-manager.js.map