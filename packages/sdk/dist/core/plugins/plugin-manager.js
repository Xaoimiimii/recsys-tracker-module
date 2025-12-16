import { ErrorBoundary } from '../error-handling/error-boundary';
export class PluginManager {
    constructor(tracker) {
        this.plugins = new Map();
        this.tracker = tracker;
        this.errorBoundary = new ErrorBoundary(true); // Enable debug mode
    }
    // Register a plugin
    register(plugin) {
        this.errorBoundary.execute(() => {
            if (this.plugins.has(plugin.name)) {
                console.warn(`[PluginManager] Plugin "${plugin.name}" already registered`);
                return;
            }
            plugin.init(this.tracker);
            this.plugins.set(plugin.name, plugin);
            console.log(`[PluginManager] Registered plugin: ${plugin.name}`);
        }, 'PluginManager.register');
    }
    // Unregister a plugin
    unregister(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
                return false;
            }
            plugin.destroy();
            this.plugins.delete(pluginName);
            console.log(`[PluginManager] Unregistered plugin: ${pluginName}`);
            return true;
        }, 'PluginManager.unregister')) !== null && _a !== void 0 ? _a : false;
    }
    // Start a specific plugin
    start(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
                return false;
            }
            plugin.start();
            return true;
        }, 'PluginManager.start')) !== null && _a !== void 0 ? _a : false;
    }
    // Stop a specific plugin
    stop(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
                return false;
            }
            plugin.stop();
            return true;
        }, 'PluginManager.stop')) !== null && _a !== void 0 ? _a : false;
    }
    // Start all registered plugins
    startAll() {
        this.errorBoundary.execute(() => {
            console.log(`[PluginManager] Starting ${this.plugins.size} plugin(s)...`);
            this.plugins.forEach((plugin) => {
                if (!plugin.isActive()) {
                    plugin.start();
                }
            });
        }, 'PluginManager.startAll');
    }
    // Stop all registered plugins
    stopAll() {
        this.errorBoundary.execute(() => {
            console.log(`[PluginManager] Stopping ${this.plugins.size} plugin(s)...`);
            this.plugins.forEach((plugin) => {
                if (plugin.isActive()) {
                    plugin.stop();
                }
            });
        }, 'PluginManager.stopAll');
    }
    // Get a plugin by name
    get(pluginName) {
        return this.plugins.get(pluginName);
    }
    // Check if a plugin is registered
    has(pluginName) {
        return this.plugins.has(pluginName);
    }
    // Get all registered plugin names
    getPluginNames() {
        return Array.from(this.plugins.keys());
    }
    // Get plugin status
    getStatus() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            active: plugin.isActive(),
        }));
    }
    // Destroy all plugins and cleanup
    destroy() {
        this.errorBoundary.execute(() => {
            console.log(`[PluginManager] Destroying ${this.plugins.size} plugin(s)...`);
            this.plugins.forEach((plugin) => {
                plugin.destroy();
            });
            this.plugins.clear();
        }, 'PluginManager.destroy');
    }
}
//# sourceMappingURL=plugin-manager.js.map