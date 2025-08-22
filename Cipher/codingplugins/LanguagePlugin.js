/**
 * 🚀 Cipher Coding Plugins - Language Plugin Framework
 * Universal Language Plugin Interface and Registry System
 * 
 * This file provides the base classes and interfaces needed to implement
 * language plugins for the multi-language code generation engine.
 */

/**
 * Result of code generation process
 * @typedef {Object} CodeGenerationResult
 * @property {boolean} success - Generation success flag
 * @property {string} code - Generated source code
 * @property {string|null} error - Error message (if failed)
 * @property {Array<string>} warnings - Non-fatal warnings
 * @property {Array<string>} dependencies - Required external dependencies
 * @property {number} [generationTimeMs] - Time taken for generation in milliseconds
 */

/**
 * AST transformation options
 * @typedef {Object} ASTOptions
 * @property {boolean} [stripComments=false] - Strip comments from AST
 * @property {boolean} [stripMetadata=false] - Strip metadata from AST
 * @property {boolean} [stripTestVectors=false] - Strip test vector data from AST
 * @property {boolean} [removeDebugCode=false] - Remove debug statements
 */

/**
 * Base interface for language plugins
 * Abstract base class that all language plugins must extend
 */
class LanguagePlugin {
  /**
   * Create a new language plugin
   * Subclasses must call super() and set their properties
   */
  constructor() {
    if (this.constructor === LanguagePlugin)
      throw new Error('LanguagePlugin is abstract and cannot be instantiated directly');

    /** @type {string} Human-readable display name */
    this.name = '';
    
    /** @type {string} File extension (without dot) */
    this.extension = '';
    
    /** @type {string} Unicode emoji icon for UI */
    this.icon = '📄';
    
    /** @type {string} Brief description */
    this.description = '';
    
    /** @type {string} MIME type for generated files */
    this.mimeType = 'text/plain';
    
    /** @type {string} Language version/standard */
    this.version = 'latest';
    
    /** @type {Object} Language-specific options */
    this.options = {
      indent: '  ',
      lineEnding: '\n',
      strictTypes: false
    };

  }

  /**
   * Get plugin information as a plain object
   * Useful for serialization and debugging
   * @returns {Object} Plugin metadata
   */
  getInfo() {
    return {
      name: this.name,
      extension: this.extension,
      icon: this.icon,
      description: this.description,
      mimeType: this.mimeType,
      version: this.version,
      options: { ...this.options }
    };
  }

  /**
   * Generate code from Abstract Syntax Tree
   * This is the main method that plugins must implement
   * 
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {GeneratorOptions} options - Generation options
   * @returns {CodeGenerationResult} Generation result with code or error
   * @abstract
   */
  GenerateFromAST(ast, options = {}) {
    throw new Error(`GenerateFromAST must be implemented by ${this.constructor.name}`);
  }

  /**
   * Create a successful generation result
   * Helper method for plugins to create consistent results
   * 
   * @param {string} code - Generated code
   * @param {Array<string>} [dependencies=[]] - Required dependencies
   * @param {Array<string>} [warnings=[]] - Non-fatal warnings
   * @returns {CodeGenerationResult}
   */
  CreateSuccessResult(code, dependencies = [], warnings = []) {
    return {
      success: true,
      code: code,
      error: null,
      warnings: warnings,
      dependencies: dependencies
    };
  }

  /**
   * Create a failed generation result
   * Helper method for plugins to create consistent error results
   * 
   * @param {string} errorMessage - Error description
   * @param {Array<string>} [warnings=[]] - Non-fatal warnings that occurred before failure
   * @returns {CodeGenerationResult}
   */
  CreateErrorResult(errorMessage, warnings = []) {
    return {
      success: false,
      code: '',
      error: errorMessage,
      warnings: warnings,
      dependencies: []
    };
  }
}

/**
 * Central registry for all language plugins
 * Static class that manages plugin registration and retrieval
 */
class LanguagePlugins {
  /** @type {Map<string, LanguagePlugin>} Map of plugin names to instances */
  static plugins = new Map();

  /**
   * Register a new language plugin
   * 
   * @param {LanguagePlugin} plugin - Plugin instance to register
   * @throws {Error} If plugin is invalid or already registered
   */
  static Add(plugin) {
    // Validate plugin instance
    if (!(plugin instanceof LanguagePlugin))
      throw new Error('Plugin must be an instance of LanguagePlugin');

    // Validate required properties
    if (!plugin.name || !plugin.extension)
      throw new Error('Plugin must have name and extension properties');

    // Check for name conflicts (names must be unique)
    if (this.plugins.has(plugin.name))
      throw new Error(`Plugin with name '${plugin.name}' is already registered`);

    // Register the plugin by name
    this.plugins.set(plugin.name, plugin);

    console.log(`✅ Registered language plugin: ${plugin.name} (.${plugin.extension})`);
  }

  /**
   * Get plugin by file extension
   * Returns the first plugin for the extension, or null if none found
   * 
   * @param {string} extension - File extension (with or without dot)
   * @returns {LanguagePlugin|null} Plugin instance or null if not found
   */
  static GetByExtension(extension) {
    // Normalize extension (remove leading dot if present)
    const normalizedExt = extension.startsWith('.') ? extension.slice(1) : extension;
    
    for (const plugin of this.plugins.values()) {
      if (plugin.extension === normalizedExt) {
        return plugin;
      }
    }
    return null;
  }

  /**
   * Get all plugins for a file extension
   * 
   * @param {string} extension - File extension (with or without dot)
   * @returns {Array<LanguagePlugin>} Array of plugin instances for this extension
   */
  static GetAllByExtension(extension) {
    // Normalize extension (remove leading dot if present)
    const normalizedExt = extension.startsWith('.') ? extension.slice(1) : extension;
    
    const matches = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.extension === normalizedExt) {
        matches.push(plugin);
      }
    }
    return matches;
  }

  /**
   * Get plugin by name
   * 
   * @param {string} name - Plugin name
   * @returns {LanguagePlugin|null} Plugin instance or null if not found
   */
  static GetByName(name) {
    return this.plugins.get(name) || null;
  }

  /**
   * Get all available plugins
   * 
   * @returns {Array<LanguagePlugin>} Array of all registered plugins
   */
  static GetAll() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all available extensions
   * 
   * @returns {Array<string>} Array of all registered file extensions
   */
  static GetAllExtensions() {
    const extensions = new Set();
    for (const plugin of this.plugins.values()) {
      extensions.add(plugin.extension);
    }
    return Array.from(extensions);
  }

  /**
   * Get extensions with plugin counts
   * 
   * @returns {Object} Object mapping extensions to plugin counts
   */
  static GetExtensionCounts() {
    const counts = {};
    for (const plugin of this.plugins.values()) {
      counts[plugin.extension] = (counts[plugin.extension] || 0) + 1;
    }
    return counts;
  }

  /**
   * Check if a plugin is registered by name
   * 
   * @param {string} name - Plugin name
   * @returns {boolean} True if plugin exists
   */
  static HasPlugin(name) {
    return this.plugins.has(name);
  }

  /**
   * Check if an extension is supported
   * 
   * @param {string} extension - File extension
   * @returns {boolean} True if extension is supported
   */
  static HasExtension(extension) {
    return GetByExtension(extension) !== null;
  }

  /**
   * Remove a plugin from the registry
   * 
   * @param {string} name - Plugin name to remove
   * @returns {boolean} True if plugin was removed, false if not found
   */
  static Remove(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    // Remove from name map
    this.plugins.delete(name);
    
    console.log(`🗑️ Removed language plugin: ${name}`);
    return true;
  }

  /**
   * Clear all registered plugins
   * Useful for testing or reinitialization
   */
  static Clear() {
    const count = this.plugins.size;
    this.plugins.clear();
    console.log(`🧹 Cleared ${count} language plugins`);
  }

  /**
   * Get registry statistics
   * 
   * @returns {Object} Statistics about registered plugins
   */
  static GetStats() {
    const plugins = this.GetAll();
    const extensions = this.GetAllExtensions();
    const extensionCounts = this.GetExtensionCounts();
    
    return {
      totalPlugins: plugins.length,
      totalExtensions: extensions.length,
      extensions: extensions,
      extensionCounts: extensionCounts,
      pluginNames: plugins.map(p => p.name),
      mostCommonMimeType: this._getMostCommonMimeType(plugins),
      conflictingExtensions: Object.entries(extensionCounts).filter(([_, count]) => count > 1)
    };
  }

  /**
   * Find the most common MIME type among registered plugins
   * @private
   */
  static _getMostCommonMimeType(plugins) {
    const mimeTypes = plugins.map(p => p.mimeType);
    const counts = {};
    
    mimeTypes.forEach(type => {
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'text/plain');
  }

  /**
   * Export all plugins as JSON (for debugging/inspection)
   * 
   * @returns {Array<Object>} Array of plugin information objects
   */
  static ExportPluginsInfo() {
    return this.GetAll().map(plugin => plugin.getInfo());
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LanguagePlugin,
    LanguagePlugins
  };
}

// Global registration for browser environment
if (typeof window !== 'undefined') {
  window.LanguagePlugin = LanguagePlugin;
  window.LanguagePlugins = LanguagePlugins;
}
