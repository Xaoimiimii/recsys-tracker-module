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
                return;
            }
            plugin.init(this.tracker);
            this.plugins.set(plugin.name, plugin);
        }, 'PluginManager.register');
    }
    // Unregister a plugin
    unregister(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                return false;
            }
            plugin.destroy();
            this.plugins.delete(pluginName);
            return true;
        }, 'PluginManager.unregister')) !== null && _a !== void 0 ? _a : false;
    }
    // Start a specific plugin
    start(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
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
                return false;
            }
            plugin.stop();
            return true;
        }, 'PluginManager.stop')) !== null && _a !== void 0 ? _a : false;
    }
    // Start all registered plugins
    startAll() {
        this.errorBoundary.execute(() => {
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
            this.plugins.forEach((plugin) => {
                plugin.destroy();
            });
            this.plugins.clear();
        }, 'PluginManager.destroy');
    }
}
//# sourceMappingURL=plugin-manager.js.map