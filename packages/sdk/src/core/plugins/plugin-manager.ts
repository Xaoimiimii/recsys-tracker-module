import { IPlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { ErrorBoundary } from '../error-handling/error-boundary';

export class PluginManager {
  private plugins: Map<string, IPlugin> = new Map();
  private tracker: RecSysTracker;
  private errorBoundary: ErrorBoundary;
  
  constructor(tracker: RecSysTracker) {
    this.tracker = tracker;
    this.errorBoundary = new ErrorBoundary(true); // Enable debug mode
  }
  
  // Register a plugin
  register(plugin: IPlugin): void {
    this.errorBoundary.execute(() => {
      if (this.plugins.has(plugin.name)) {
        return;
      }
      
      plugin.init(this.tracker);
      this.plugins.set(plugin.name, plugin);

    }, 'PluginManager.register');
  }
  
  // Unregister a plugin
  unregister(pluginName: string): boolean {
    return this.errorBoundary.execute(() => {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
        return false;
      }
      
      plugin.destroy();
      this.plugins.delete(pluginName);
      console.log(`[PluginManager] Unregistered plugin: ${pluginName}`);
      return true;
    }, 'PluginManager.unregister') ?? false;
  }
  
  // Start a specific plugin
  start(pluginName: string): boolean {
    return this.errorBoundary.execute(() => {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
        return false;
      }
      
      plugin.start();
      return true;
    }, 'PluginManager.start') ?? false;
  }
  
  // Stop a specific plugin
  stop(pluginName: string): boolean {
    return this.errorBoundary.execute(() => {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
        return false;
      }
      
      plugin.stop();
      return true;
    }, 'PluginManager.stop') ?? false;
  }
  
  // Start all registered plugins
  startAll(): void {
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
  stopAll(): void {
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
  get(pluginName: string): IPlugin | undefined {
    return this.plugins.get(pluginName);
  }
  
  // Check if a plugin is registered
  has(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }
  
  // Get all registered plugin names
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }
  
  // Get plugin status
  getStatus(): { name: string; active: boolean }[] {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      active: plugin.isActive(),
    }));
  }
  
  // Destroy all plugins and cleanup
  destroy(): void {
    this.errorBoundary.execute(() => {
      console.log(`[PluginManager] Destroying ${this.plugins.size} plugin(s)...`);
      this.plugins.forEach((plugin) => {
        plugin.destroy();
      });
      this.plugins.clear();
    }, 'PluginManager.destroy');
  }
}
