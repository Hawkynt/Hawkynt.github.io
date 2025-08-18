/*
 * Cipher Memory Manager
 * Advanced memory management and cleanup for cipher operations
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Memory management utilities
  const CipherMemoryManager = {
    
    // Configuration
    config: {
      enableGarbageCollection: true,
      gcThresholdMB: 50, // Trigger GC when memory usage exceeds this
      enableLeakDetection: true,
      maxInstanceAge: 300000, // 5 minutes in milliseconds
      pooledArraySizes: [8, 16, 32, 64, 128, 256],
      maxPoolSize: 100
    },
    
    // Memory tracking
    tracking: {
      instances: new Map(), // Track cipher instances
      allocations: new Map(), // Track memory allocations
      peaks: {
        heapUsed: 0,
        instanceCount: 0,
        allocationCount: 0
      },
      startTime: Date.now()
    },
    
    // Array pools for different sizes
    arrayPools: {},
    
    /**
     * Initialize memory manager
     */
    init: function() {
      // Initialize array pools
      this.config.pooledArraySizes.forEach(size => {
        this.arrayPools[size] = [];
      });
      
      // Set up periodic cleanup if in Node.js
      if (typeof setInterval !== 'undefined') {
        setInterval(() => {
          this.performPeriodicCleanup();
        }, 30000); // Run every 30 seconds
      }
      
      console.log('[MemoryManager] Initialized with pools for sizes:', this.config.pooledArraySizes);
    },
    
    /**
     * Get memory snapshot
     * @returns {Object} Memory information
     */
    getMemorySnapshot: function() {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage();
      }
      if (typeof performance !== 'undefined' && performance.memory) {
        return {
          rss: 0,
          heapTotal: performance.memory.totalJSHeapSize,
          heapUsed: performance.memory.usedJSHeapSize,
          external: 0,
          arrayBuffers: 0
        };
      }
      return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
    },
    
    /**
     * Track cipher instance creation
     * @param {string} instanceId - Instance ID
     * @param {string} cipherName - Cipher name
     * @param {Object} metadata - Additional metadata
     */
    trackInstance: function(instanceId, cipherName, metadata) {
      const record = {
        id: instanceId,
        cipherName: cipherName,
        createdAt: Date.now(),
        metadata: metadata || {},
        memoryAtCreation: this.getMemorySnapshot(),
        alive: true
      };
      
      this.tracking.instances.set(instanceId, record);
      
      // Update peak tracking
      const currentCount = this.tracking.instances.size;
      if (currentCount > this.tracking.peaks.instanceCount) {
        this.tracking.peaks.instanceCount = currentCount;
      }
      
      const currentMemory = record.memoryAtCreation.heapUsed;
      if (currentMemory > this.tracking.peaks.heapUsed) {
        this.tracking.peaks.heapUsed = currentMemory;
      }
      
      return record;
    },
    
    /**
     * Track instance cleanup
     * @param {string} instanceId - Instance ID
     */
    untrackInstance: function(instanceId) {
      const record = this.tracking.instances.get(instanceId);
      if (record) {
        record.alive = false;
        record.destroyedAt = Date.now();
        record.memoryAtDestruction = this.getMemorySnapshot();
        
        // Keep record for leak detection, but mark as cleaned up
        setTimeout(() => {
          this.tracking.instances.delete(instanceId);
        }, 60000); // Remove from tracking after 1 minute
        
        return record;
      }
      return null;
    },
    
    /**
     * Get pooled array from memory pool
     * @param {number} size - Required array size
     * @returns {Array} Pooled array or new array
     */
    getPooledArray: function(size) {
      // Find appropriate pool size
      let poolSize = null;
      for (const ps of this.config.pooledArraySizes) {
        if (ps >= size) {
          poolSize = ps;
          break;
        }
      }
      
      if (poolSize && this.arrayPools[poolSize]) {
        const pool = this.arrayPools[poolSize];
        if (pool.length > 0) {
          const array = pool.pop();
          // Clear the array
          for (let i = 0; i < size; i++) {
            array[i] = 0;
          }
          array.length = size; // Adjust to requested size
          
          // Track allocation
          this.trackAllocation('pooled_array', size, array);
          return array;
        }
      }
      
      // Create new array if pool is empty or size doesn't fit
      const array = new Array(size);
      for (let i = 0; i < size; i++) {
        array[i] = 0;
      }
      
      this.trackAllocation('new_array', size, array);
      return array;
    },
    
    /**
     * Return array to pool
     * @param {Array} array - Array to return
     */
    returnArrayToPool: function(array) {
      if (!array || !Array.isArray(array)) return;
      
      const size = array.length;
      let poolSize = null;
      
      // Find appropriate pool
      for (const ps of this.config.pooledArraySizes) {
        if (ps >= size) {
          poolSize = ps;
          break;
        }
      }
      
      if (poolSize && this.arrayPools[poolSize]) {
        const pool = this.arrayPools[poolSize];
        if (pool.length < this.config.maxPoolSize) {
          // Resize array to pool size and clear it
          array.length = poolSize;
          for (let i = 0; i < poolSize; i++) {
            array[i] = 0;
          }
          pool.push(array);
          
          this.untrackAllocation(array);
          return true;
        }
      }
      
      this.untrackAllocation(array);
      return false; // Not pooled
    },
    
    /**
     * Track memory allocation
     * @param {string} type - Allocation type
     * @param {number} size - Size of allocation
     * @param {*} reference - Reference to allocated object
     */
    trackAllocation: function(type, size, reference) {
      if (!this.config.enableLeakDetection) return;
      
      const id = this.generateAllocationId();
      const record = {
        id: id,
        type: type,
        size: size,
        allocatedAt: Date.now(),
        stackTrace: new Error().stack,
        reference: new WeakRef(reference) // Use WeakRef to avoid memory leaks
      };
      
      this.tracking.allocations.set(id, record);
      
      // Update peak tracking
      const currentCount = this.tracking.allocations.size;
      if (currentCount > this.tracking.peaks.allocationCount) {
        this.tracking.peaks.allocationCount = currentCount;
      }
      
      return id;
    },
    
    /**
     * Untrack allocation
     * @param {*} reference - Reference to deallocated object
     */
    untrackAllocation: function(reference) {
      if (!this.config.enableLeakDetection) return;
      
      // Find allocation by reference (this is expensive, but needed for leak detection)
      for (const [id, record] of this.tracking.allocations.entries()) {
        if (record.reference.deref() === reference) {
          this.tracking.allocations.delete(id);
          return true;
        }
      }
      return false;
    },
    
    /**
     * Generate unique allocation ID
     * @returns {string} Unique ID
     */
    generateAllocationId: function() {
      return 'alloc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    /**
     * Secure memory clearing for sensitive data
     * @param {Array|Object} data - Data to clear
     */
    secureClear: function(data) {
      if (Array.isArray(data)) {
        // Clear array
        for (let i = 0; i < data.length; i++) {
          data[i] = 0;
        }
        data.length = 0;
      } else if (data && typeof data === 'object') {
        // Clear object properties
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            if (Array.isArray(data[key])) {
              this.secureClear(data[key]);
            } else if (typeof data[key] === 'object') {
              this.secureClear(data[key]);
            } else {
              data[key] = null;
            }
          }
        }
      }
    },
    
    /**
     * Perform periodic cleanup
     */
    performPeriodicCleanup: function() {
      const now = Date.now();
      let cleanedInstances = 0;
      let cleanedAllocations = 0;
      
      // Clean up old instances
      for (const [id, record] of this.tracking.instances.entries()) {
        if (!record.alive && (now - record.destroyedAt > 60000)) {
          this.tracking.instances.delete(id);
          cleanedInstances++;
        } else if (record.alive && (now - record.createdAt > this.config.maxInstanceAge)) {
          console.warn(`[MemoryManager] Long-lived instance detected: ${id} (${record.cipherName})`);
        }
      }
      
      // Clean up dead allocations (where WeakRef has been garbage collected)
      for (const [id, record] of this.tracking.allocations.entries()) {
        if (!record.reference.deref()) {
          this.tracking.allocations.delete(id);
          cleanedAllocations++;
        }
      }
      
      // Trigger GC if memory usage is high
      const memory = this.getMemorySnapshot();
      const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
      
      if (this.config.enableGarbageCollection && heapUsedMB > this.config.gcThresholdMB) {
        if (typeof global.gc === 'function') {
          console.log(`[MemoryManager] Triggering GC (heap: ${heapUsedMB}MB)`);
          global.gc();
        }
      }
      
      if (cleanedInstances > 0 || cleanedAllocations > 0) {
        console.log(`[MemoryManager] Cleanup: ${cleanedInstances} instances, ${cleanedAllocations} allocations`);
      }
    },
    
    /**
     * Detect potential memory leaks
     * @returns {Object} Leak detection report
     */
    detectLeaks: function() {
      const now = Date.now();
      const report = {
        suspiciousInstances: [],
        suspiciousAllocations: [],
        totalInstances: this.tracking.instances.size,
        totalAllocations: this.tracking.allocations.size,
        memoryUsage: this.getMemorySnapshot()
      };
      
      // Check for long-lived instances
      for (const [id, record] of this.tracking.instances.entries()) {
        const age = now - record.createdAt;
        if (record.alive && age > this.config.maxInstanceAge) {
          report.suspiciousInstances.push({
            id: id,
            cipherName: record.cipherName,
            age: age,
            memoryAtCreation: record.memoryAtCreation
          });
        }
      }
      
      // Check for old allocations
      for (const [id, record] of this.tracking.allocations.entries()) {
        const age = now - record.allocatedAt;
        if (age > 300000 && record.reference.deref()) { // 5 minutes
          report.suspiciousAllocations.push({
            id: id,
            type: record.type,
            size: record.size,
            age: age
          });
        }
      }
      
      return report;
    },
    
    /**
     * Get memory statistics
     * @returns {Object} Memory statistics
     */
    getStats: function() {
      const memory = this.getMemorySnapshot();
      const uptime = Date.now() - this.tracking.startTime;
      
      // Calculate pool statistics
      const poolStats = {};
      let totalPooledArrays = 0;
      for (const [size, pool] of Object.entries(this.arrayPools)) {
        poolStats[size] = pool.length;
        totalPooledArrays += pool.length;
      }
      
      return {
        uptime: uptime,
        memory: {
          current: memory,
          peaks: this.tracking.peaks
        },
        instances: {
          current: this.tracking.instances.size,
          peak: this.tracking.peaks.instanceCount
        },
        allocations: {
          current: this.tracking.allocations.size,
          peak: this.tracking.peaks.allocationCount
        },
        pools: {
          sizes: this.config.pooledArraySizes,
          stats: poolStats,
          totalPooled: totalPooledArrays
        }
      };
    },
    
    /**
     * Reset all tracking and pools
     */
    reset: function() {
      this.tracking.instances.clear();
      this.tracking.allocations.clear();
      this.tracking.peaks = {
        heapUsed: 0,
        instanceCount: 0,
        allocationCount: 0
      };
      
      // Clear all pools
      for (const size of this.config.pooledArraySizes) {
        this.arrayPools[size] = [];
      }
      
      this.tracking.startTime = Date.now();
      console.log('[MemoryManager] Reset completed');
    },
    
    /**
     * Configure memory manager
     * @param {Object} newConfig - New configuration options
     */
    configure: function(newConfig) {
      Object.assign(this.config, newConfig);
      console.log('[MemoryManager] Configuration updated');
    }
  };
  
  // Auto-initialize
  CipherMemoryManager.init();
  
  // Export memory manager
  global.CipherMemoryManager = CipherMemoryManager;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherMemoryManager;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);