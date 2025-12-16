import { IPlugin } from './base-plugin';
import { RecSysTracker } from '../..';

export class PluginManager {
  private plugins: Map<string, IPlugin> = new Map();
  private tracker: RecSysTracker;
  
  constructor(tracker: RecSysTracker) {
    this.tracker = tracker;
  }
  
  // Register a plugin
  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] Plugin "${plugin.name}" already registered`);
      return;
    }
    
    try {
      plugin.init(this.tracker);
      this.plugins.set(plugin.name, plugin);
      console.log(`[PluginManager] Registered plugin: ${plugin.name}`);
    } catch (error) {
      console.error(`[PluginManager] Failed to register plugin "${plugin.name}":`, error);
    }
  }
  
  // Unregister a plugin
  unregister(pluginName: string): boolean {
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
    } catch (error) {
      console.error(`[PluginManager] Failed to unregister plugin "${pluginName}":`, error);
      return false;
    }
  }
  
  // Start a specific plugin
  start(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
      return false;
    }
    
    try {
      plugin.start();
      return true;
    } catch (error) {
      console.error(`[PluginManager] Failed to start plugin "${pluginName}":`, error);
      return false;
    }
  }
  
  // Stop a specific plugin
  stop(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
      return false;
    }
    
    try {
      plugin.stop();
      return true;
    } catch (error) {
      console.error(`[PluginManager] Failed to stop plugin "${pluginName}":`, error);
      return false;
    }
  }
  
  // Start all registered plugins
  startAll(): void {
    console.log(`[PluginManager] Starting ${this.plugins.size} plugin(s)...`);
    this.plugins.forEach((plugin, name) => {
      try {
        if (!plugin.isActive()) {
          plugin.start();
        }
      } catch (error) {
        console.error(`[PluginManager] Failed to start plugin "${name}":`, error);
      }
    });
  }
  
  // Stop all registered plugins
  stopAll(): void {
    console.log(`[PluginManager] Stopping ${this.plugins.size} plugin(s)...`);
    this.plugins.forEach((plugin, name) => {
      try {
        if (plugin.isActive()) {
          plugin.stop();
        }
      } catch (error) {
        console.error(`[PluginManager] Failed to stop plugin "${name}":`, error);
      }
    });
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
    console.log(`[PluginManager] Destroying ${this.plugins.size} plugin(s)...`);
    this.plugins.forEach((plugin, name) => {
      try {
        plugin.destroy();
      } catch (error) {
        console.error(`[PluginManager] Failed to destroy plugin "${name}":`, error);
      }
    });
    this.plugins.clear();
  }
}
