/*
 * Interactive Test Vector Interface
 * Advanced UI for test vector management and batch testing
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  const TestInterface = {
    
    // Interface state
    state: {
      selectedVectors: new Set(),
      filterCriteria: {
        algorithm: '',
        category: '',
        status: '',
        source: ''
      },
      sortColumn: 'algorithm',
      sortDirection: 'asc',
      currentView: 'table',
      testResults: {},
      isRunning: false
    },
    
    // Initialize the test interface
    init: function() {
      console.log('Initializing Test Vector Interface...');
      this.setupEventHandlers();
      this.renderInterface();
      this.loadTestData();
    },
    
    // Setup event handlers for interactive elements
    setupEventHandlers: function() {
      // Filter controls
      const algorithmFilter = document.getElementById('filter-algorithm');
      const categoryFilter = document.getElementById('filter-category');
      const statusFilter = document.getElementById('filter-status');
      const sourceFilter = document.getElementById('filter-source');
      
      if (algorithmFilter) algorithmFilter.addEventListener('change', () => this.applyFilters());
      if (categoryFilter) categoryFilter.addEventListener('change', () => this.applyFilters());
      if (statusFilter) statusFilter.addEventListener('change', () => this.applyFilters());
      if (sourceFilter) sourceFilter.addEventListener('change', () => this.applyFilters());
      
      // Batch operation controls
      const selectAllBtn = document.getElementById('select-all-btn');
      const selectNoneBtn = document.getElementById('select-none-btn');
      const runSelectedBtn = document.getElementById('run-selected-btn');
      const runAllBtn = document.getElementById('run-all-btn');
      
      if (selectAllBtn) selectAllBtn.addEventListener('click', () => this.selectAll());
      if (selectNoneBtn) selectNoneBtn.addEventListener('click', () => this.selectNone());
      if (runSelectedBtn) runSelectedBtn.addEventListener('click', () => this.runSelectedTests());
      if (runAllBtn) runAllBtn.addEventListener('click', () => this.runAllTests());
      
      // View controls
      const tableViewBtn = document.getElementById('table-view-btn');
      const cardViewBtn = document.getElementById('card-view-btn');
      const statsViewBtn = document.getElementById('stats-view-btn');
      
      if (tableViewBtn) tableViewBtn.addEventListener('click', () => this.switchView('table'));
      if (cardViewBtn) cardViewBtn.addEventListener('click', () => this.switchView('card'));
      if (statsViewBtn) statsViewBtn.addEventListener('click', () => this.switchView('stats'));
      
      // Export controls
      const exportBtn = document.getElementById('export-results-btn');
      const exportDbBtn = document.getElementById('export-database-btn');
      
      if (exportBtn) exportBtn.addEventListener('click', () => this.exportResults());
      if (exportDbBtn) exportDbBtn.addEventListener('click', () => this.exportDatabase());
    },
    
    // Render the main interface structure
    renderInterface: function() {
      const container = document.getElementById('test-interface');
      if (!container) {
        console.error('Test interface container not found');
        return;
      }
      
      container.innerHTML = `
        <div class="test-interface-header">
          <h2>Test Vector Management System</h2>
          <div class="interface-stats">
            <span id="total-vectors">Loading...</span>
            <span id="selected-count">0 selected</span>
            <span id="test-progress" style="display: none;"></span>
          </div>
        </div>
        
        <div class="test-interface-controls">
          <div class="filter-section">
            <h3>Filters</h3>
            <div class="filter-row">
              <select id="filter-algorithm">
                <option value="">All Algorithms</option>
              </select>
              <select id="filter-category">
                <option value="">All Categories</option>
                <option value="official">Official</option>
                <option value="reference">Reference</option>
                <option value="educational">Educational</option>
                <option value="edge-case">Edge Case</option>
                <option value="standard">Standard</option>
              </select>
              <select id="filter-status">
                <option value="">All Status</option>
                <option value="verified">Verified</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="unknown">Unknown</option>
              </select>
              <select id="filter-source">
                <option value="">All Sources</option>
                <option value="nist">NIST</option>
                <option value="rfc">RFC</option>
                <option value="ieee">IEEE</option>
                <option value="academic">Academic</option>
                <option value="reference">Reference</option>
                <option value="generated">Generated</option>
              </select>
            </div>
          </div>
          
          <div class="batch-section">
            <h3>Batch Operations</h3>
            <div class="batch-controls">
              <button id="select-all-btn" class="btn btn-secondary">Select All</button>
              <button id="select-none-btn" class="btn btn-secondary">Select None</button>
              <button id="run-selected-btn" class="btn btn-primary">Run Selected</button>
              <button id="run-all-btn" class="btn btn-warning">Run All Tests</button>
            </div>
          </div>
          
          <div class="view-section">
            <h3>View</h3>
            <div class="view-controls">
              <button id="table-view-btn" class="btn btn-secondary active">Table</button>
              <button id="card-view-btn" class="btn btn-secondary">Cards</button>
              <button id="stats-view-btn" class="btn btn-secondary">Statistics</button>
            </div>
          </div>
          
          <div class="export-section">
            <h3>Export</h3>
            <div class="export-controls">
              <button id="export-results-btn" class="btn btn-info">Export Results</button>
              <button id="export-database-btn" class="btn btn-info">Export Database</button>
            </div>
          </div>
        </div>
        
        <div class="test-interface-content">
          <div id="table-view" class="view-panel active">
            <div class="table-container">
              <table id="test-vectors-table" class="test-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" id="header-checkbox"></th>
                    <th data-sort="algorithm">Algorithm</th>
                    <th data-sort="description">Description</th>
                    <th data-sort="category">Category</th>
                    <th data-sort="source">Source</th>
                    <th data-sort="status">Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="test-vectors-tbody">
                  <!-- Test vectors will be populated here -->
                </tbody>
              </table>
            </div>
          </div>
          
          <div id="card-view" class="view-panel">
            <div id="test-vectors-cards" class="cards-container">
              <!-- Test vector cards will be populated here -->
            </div>
          </div>
          
          <div id="stats-view" class="view-panel">
            <div id="statistics-content" class="stats-container">
              <!-- Statistics will be populated here -->
            </div>
          </div>
        </div>
        
        <div id="test-results-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Test Results</h3>
              <button id="close-modal" class="btn btn-close">&times;</button>
            </div>
            <div id="modal-body" class="modal-body">
              <!-- Test results will be displayed here -->
            </div>
          </div>
        </div>
      `;
      
      this.setupTableSorting();
      this.setupModalHandlers();
    },
    
    // Load test data from the database
    loadTestData: function() {
      if (!global.TestVectorDatabase) {
        console.error('TestVectorDatabase not available');
        return;
      }
      
      // Initialize database if not already done
      if (Object.keys(global.TestVectorDatabase.vectors).length === 0) {
        global.TestVectorDatabase.init();
      }
      
      this.updateInterfaceStats();
      this.populateFilterOptions();
      this.renderCurrentView();
    },
    
    // Update interface statistics
    updateInterfaceStats: function() {
      const totalElement = document.getElementById('total-vectors');
      const selectedElement = document.getElementById('selected-count');
      
      if (totalElement && global.TestVectorDatabase) {
        const totalCount = global.TestVectorDatabase.getTotalVectorCount();
        const algorithmCount = Object.keys(global.TestVectorDatabase.vectors).length;
        totalElement.textContent = `${totalCount} vectors across ${algorithmCount} algorithms`;
      }
      
      if (selectedElement) {
        selectedElement.textContent = `${this.state.selectedVectors.size} selected`;
      }
    },
    
    // Populate filter dropdown options
    populateFilterOptions: function() {
      const algorithmSelect = document.getElementById('filter-algorithm');
      
      if (algorithmSelect && global.TestVectorDatabase) {
        const algorithms = Object.keys(global.TestVectorDatabase.vectors).sort();
        algorithmSelect.innerHTML = '<option value="">All Algorithms</option>';
        
        algorithms.forEach(algorithm => {
          const option = document.createElement('option');
          option.value = algorithm;
          option.textContent = algorithm;
          algorithmSelect.appendChild(option);
        });
      }
    },
    
    // Apply current filter criteria
    applyFilters: function() {
      // Update filter state
      this.state.filterCriteria.algorithm = document.getElementById('filter-algorithm')?.value || '';
      this.state.filterCriteria.category = document.getElementById('filter-category')?.value || '';
      this.state.filterCriteria.status = document.getElementById('filter-status')?.value || '';
      this.state.filterCriteria.source = document.getElementById('filter-source')?.value || '';
      
      // Re-render current view with filters applied
      this.renderCurrentView();
    },
    
    // Get filtered test vectors
    getFilteredVectors: function() {
      if (!global.TestVectorDatabase) return [];
      
      let vectors = [];
      
      // Collect all vectors
      Object.entries(global.TestVectorDatabase.vectors).forEach(([algorithm, algorithmVectors]) => {
        algorithmVectors.forEach(vector => {
          vectors.push({ ...vector, algorithm });
        });
      });
      
      // Apply filters
      const filters = this.state.filterCriteria;
      
      vectors = vectors.filter(vector => {
        if (filters.algorithm && vector.algorithm !== filters.algorithm) return false;
        if (filters.category && vector.category !== filters.category) return false;
        if (filters.status && vector.verification.status !== filters.status) return false;
        if (filters.source && vector.source.type !== filters.source) return false;
        return true;
      });
      
      // Apply sorting
      vectors.sort((a, b) => {
        const aValue = this.getSortValue(a, this.state.sortColumn);
        const bValue = this.getSortValue(b, this.state.sortColumn);
        
        if (this.state.sortDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
      
      return vectors;
    },
    
    // Get sort value for a vector
    getSortValue: function(vector, column) {
      switch (column) {
        case 'algorithm': return vector.algorithm;
        case 'description': return vector.description;
        case 'category': return vector.category;
        case 'source': return vector.source.type;
        case 'status': return vector.verification.status;
        default: return '';
      }
    },
    
    // Render current view
    renderCurrentView: function() {
      switch (this.state.currentView) {
        case 'table':
          this.renderTableView();
          break;
        case 'card':
          this.renderCardView();
          break;
        case 'stats':
          this.renderStatsView();
          break;
      }
    },
    
    // Render table view
    renderTableView: function() {
      const tbody = document.getElementById('test-vectors-tbody');
      if (!tbody) return;
      
      const vectors = this.getFilteredVectors();
      tbody.innerHTML = '';
      
      vectors.forEach(vector => {
        const row = document.createElement('tr');
        const vectorId = `${vector.algorithm}_${vector.testId}`;
        
        row.innerHTML = `
          <td>
            <input type="checkbox" class="vector-checkbox" data-vector-id="${vectorId}" 
                   ${this.state.selectedVectors.has(vectorId) ? 'checked' : ''}>
          </td>
          <td>${vector.algorithm}</td>
          <td title="${vector.description}">${this.truncateText(vector.description, 50)}</td>
          <td>
            <span class="category-badge category-${vector.category}">${vector.category}</span>
          </td>
          <td>
            <span class="source-badge source-${vector.source.type}">${vector.source.type}</span>
            ${vector.source.url ? `<a href="${vector.source.url}" target="_blank" title="${vector.source.title}">🔗</a>` : ''}
          </td>
          <td>
            <span class="status-badge status-${vector.verification.status}">${vector.verification.status}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="TestInterface.runSingleTest('${vectorId}')">Test</button>
            <button class="btn btn-sm btn-info" onclick="TestInterface.showVectorDetails('${vectorId}')">Details</button>
          </td>
        `;
        
        tbody.appendChild(row);
      });
      
      // Add checkbox event listeners
      document.querySelectorAll('.vector-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const vectorId = e.target.dataset.vectorId;
          if (e.target.checked) {
            this.state.selectedVectors.add(vectorId);
          } else {
            this.state.selectedVectors.delete(vectorId);
          }
          this.updateInterfaceStats();
        });
      });
    },
    
    // Render card view
    renderCardView: function() {
      const container = document.getElementById('test-vectors-cards');
      if (!container) return;
      
      const vectors = this.getFilteredVectors();
      container.innerHTML = '';
      
      vectors.forEach(vector => {
        const vectorId = `${vector.algorithm}_${vector.testId}`;
        const card = document.createElement('div');
        card.className = 'test-vector-card';
        
        card.innerHTML = `
          <div class="card-header">
            <input type="checkbox" class="vector-checkbox" data-vector-id="${vectorId}" 
                   ${this.state.selectedVectors.has(vectorId) ? 'checked' : ''}>
            <h4>${vector.algorithm}</h4>
            <span class="status-badge status-${vector.verification.status}">${vector.verification.status}</span>
          </div>
          <div class="card-body">
            <p class="description">${vector.description}</p>
            <div class="metadata">
              <span class="category-badge category-${vector.category}">${vector.category}</span>
              <span class="source-badge source-${vector.source.type}">${vector.source.type}</span>
            </div>
            <div class="vector-data">
              <div class="data-row">
                <strong>Input:</strong> <code>${this.truncateText(vector.input, 30)}</code>
              </div>
              <div class="data-row">
                <strong>Key:</strong> <code>${this.truncateText(vector.key, 30)}</code>
              </div>
              <div class="data-row">
                <strong>Expected:</strong> <code>${this.truncateText(vector.expected, 30)}</code>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-sm btn-primary" onclick="TestInterface.runSingleTest('${vectorId}')">Test</button>
            <button class="btn btn-sm btn-info" onclick="TestInterface.showVectorDetails('${vectorId}')">Details</button>
            ${vector.source.url ? `<a href="${vector.source.url}" target="_blank" class="btn btn-sm btn-secondary">Source</a>` : ''}
          </div>
        `;
        
        container.appendChild(card);
      });
      
      // Add checkbox event listeners
      document.querySelectorAll('.vector-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const vectorId = e.target.dataset.vectorId;
          if (e.target.checked) {
            this.state.selectedVectors.add(vectorId);
          } else {
            this.state.selectedVectors.delete(vectorId);
          }
          this.updateInterfaceStats();
        });
      });
    },
    
    // Render statistics view
    renderStatsView: function() {
      const container = document.getElementById('statistics-content');
      if (!container || !global.TestVectorDatabase) return;
      
      const stats = global.TestVectorDatabase.generateStatistics();
      
      container.innerHTML = `
        <div class="stats-overview">
          <h3>Overview</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${stats.overview.totalVectors}</div>
              <div class="stat-label">Total Test Vectors</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.overview.algorithms}</div>
              <div class="stat-label">Algorithms</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.overview.sources}</div>
              <div class="stat-label">Sources</div>
            </div>
          </div>
        </div>
        
        <div class="stats-section">
          <h3>Test Vectors by Category</h3>
          <div class="chart-container">
            ${this.renderBarChart(stats.byCategory, 'category')}
          </div>
        </div>
        
        <div class="stats-section">
          <h3>Test Vectors by Source</h3>
          <div class="chart-container">
            ${this.renderBarChart(stats.bySource, 'source')}
          </div>
        </div>
        
        <div class="stats-section">
          <h3>Verification Status</h3>
          <div class="chart-container">
            ${this.renderBarChart(stats.byVerification, 'verification')}
          </div>
        </div>
        
        <div class="stats-section">
          <h3>Algorithm Coverage</h3>
          <div class="coverage-table">
            <table class="coverage-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Vectors</th>
                  <th>Official</th>
                  <th>Edge Cases</th>
                  <th>Verification Rate</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(stats.coverage).map(([algorithm, coverage]) => `
                  <tr>
                    <td>${algorithm}</td>
                    <td>${coverage.count}</td>
                    <td>${coverage.hasOfficial ? '✓' : '✗'}</td>
                    <td>${coverage.hasEdgeCases ? '✓' : '✗'}</td>
                    <td>${Math.round(coverage.verificationRate * 100)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    },
    
    // Render simple bar chart
    renderBarChart: function(data, type) {
      const maxValue = Math.max(...Object.values(data));
      if (maxValue === 0) return '<p>No data available</p>';
      
      return `
        <div class="bar-chart">
          ${Object.entries(data).map(([key, value]) => `
            <div class="bar-item">
              <div class="bar-label">${key}</div>
              <div class="bar-container">
                <div class="bar-fill ${type}-${key}" style="width: ${(value / maxValue) * 100}%"></div>
                <div class="bar-value">${value}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    },
    
    // Switch between different views
    switchView: function(viewName) {
      this.state.currentView = viewName;
      
      // Update view button states
      document.querySelectorAll('.view-controls button').forEach(btn => {
        btn.classList.remove('active');
      });
      document.getElementById(`${viewName}-view-btn`)?.classList.add('active');
      
      // Show/hide view panels
      document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
      });
      document.getElementById(`${viewName}-view`)?.classList.add('active');
      
      this.renderCurrentView();
    },
    
    // Setup table sorting
    setupTableSorting: function() {
      document.querySelectorAll('th[data-sort]').forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
          const column = header.dataset.sort;
          
          if (this.state.sortColumn === column) {
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            this.state.sortColumn = column;
            this.state.sortDirection = 'asc';
          }
          
          this.renderCurrentView();
        });
      });
      
      // Header checkbox for select all
      const headerCheckbox = document.getElementById('header-checkbox');
      if (headerCheckbox) {
        headerCheckbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectAll();
          } else {
            this.selectNone();
          }
        });
      }
    },
    
    // Setup modal handlers
    setupModalHandlers: function() {
      const closeBtn = document.getElementById('close-modal');
      const modal = document.getElementById('test-results-modal');
      
      if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
          }
        });
      }
    },
    
    // Selection management
    selectAll: function() {
      const vectors = this.getFilteredVectors();
      vectors.forEach(vector => {
        const vectorId = `${vector.algorithm}_${vector.testId}`;
        this.state.selectedVectors.add(vectorId);
      });
      
      document.querySelectorAll('.vector-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
      
      this.updateInterfaceStats();
    },
    
    selectNone: function() {
      this.state.selectedVectors.clear();
      
      document.querySelectorAll('.vector-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
      
      this.updateInterfaceStats();
    },
    
    // Test execution
    runSelectedTests: function() {
      const selectedIds = Array.from(this.state.selectedVectors);
      if (selectedIds.length === 0) {
        alert('No test vectors selected');
        return;
      }
      
      this.runTests(selectedIds);
    },
    
    runAllTests: function() {
      const vectors = this.getFilteredVectors();
      const vectorIds = vectors.map(v => `${v.algorithm}_${v.testId}`);
      this.runTests(vectorIds);
    },
    
    runSingleTest: function(vectorId) {
      this.runTests([vectorId]);
    },
    
    // Main test execution function
    runTests: async function(vectorIds) {
      if (this.state.isRunning) {
        alert('Tests are already running');
        return;
      }
      
      this.state.isRunning = true;
      this.state.testResults = {};
      
      const progressElement = document.getElementById('test-progress');
      if (progressElement) {
        progressElement.style.display = 'inline';
        progressElement.textContent = `Running 0/${vectorIds.length} tests...`;
      }
      
      try {
        for (let i = 0; i < vectorIds.length; i++) {
          const vectorId = vectorIds[i];
          const vector = this.findVectorById(vectorId);
          
          if (progressElement) {
            progressElement.textContent = `Running ${i + 1}/${vectorIds.length} tests...`;
          }
          
          if (vector) {
            try {
              const result = await this.executeTest(vector);
              this.state.testResults[vectorId] = result;
              
              // Update verification status in database
              if (global.TestVectorDatabase && global.TestVectorDatabase.vectors[vector.algorithm]) {
                const dbVector = global.TestVectorDatabase.vectors[vector.algorithm].find(v => 
                  `${vector.algorithm}_${v.testId}` === vectorId
                );
                if (dbVector) {
                  dbVector.verification.status = result.success ? 'verified' : 'failed';
                  dbVector.verification.lastChecked = new Date().toISOString();
                  dbVector.verification.errorDetails = result.error || '';
                }
              }
            } catch (error) {
              this.state.testResults[vectorId] = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
              };
            }
          }
          
          // Small delay to prevent UI blocking
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        this.showTestResults();
        
      } finally {
        this.state.isRunning = false;
        if (progressElement) {
          progressElement.style.display = 'none';
        }
        
        // Refresh current view to show updated status
        this.renderCurrentView();
      }
    },
    
    // Execute individual test
    executeTest: function(vector) {
      return new Promise((resolve) => {
        try {
          if (!global.Cipher || !global.Cipher.boolExistsCipher(vector.algorithm)) {
            resolve({
              success: false,
              error: `Cipher ${vector.algorithm} not available`,
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          // Initialize cipher
          const cipherID = global.Cipher.InitCipher(vector.algorithm, vector.key);
          if (!cipherID) {
            resolve({
              success: false,
              error: 'Failed to initialize cipher',
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          // Perform encryption
          const output = global.Cipher.szEncrypt(cipherID, vector.input);
          const trimmedOutput = output.substring(0, vector.expected.length);
          
          // Clean up
          global.Cipher.ClearData(cipherID);
          
          // Compare results
          const success = trimmedOutput === vector.expected;
          
          resolve({
            success: success,
            input: vector.input,
            key: vector.key,
            expected: vector.expected,
            actual: trimmedOutput,
            error: success ? null : 'Output mismatch',
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });
    },
    
    // Find vector by ID
    findVectorById: function(vectorId) {
      const [algorithm, testId] = vectorId.split('_', 2);
      
      if (global.TestVectorDatabase && global.TestVectorDatabase.vectors[algorithm]) {
        return global.TestVectorDatabase.vectors[algorithm].find(v => 
          `${algorithm}_${v.testId}` === vectorId
        );
      }
      
      return null;
    },
    
    // Show test results in modal
    showTestResults: function() {
      const modal = document.getElementById('test-results-modal');
      const modalBody = document.getElementById('modal-body');
      
      if (!modal || !modalBody) return;
      
      const results = this.state.testResults;
      const totalTests = Object.keys(results).length;
      const passedTests = Object.values(results).filter(r => r.success).length;
      const failedTests = totalTests - passedTests;
      
      modalBody.innerHTML = `
        <div class="results-summary">
          <h4>Test Summary</h4>
          <div class="summary-stats">
            <span class="stat passed">Passed: ${passedTests}</span>
            <span class="stat failed">Failed: ${failedTests}</span>
            <span class="stat total">Total: ${totalTests}</span>
            <span class="stat rate">Success Rate: ${Math.round((passedTests / totalTests) * 100)}%</span>
          </div>
        </div>
        
        <div class="results-details">
          <h4>Detailed Results</h4>
          <div class="results-list">
            ${Object.entries(results).map(([vectorId, result]) => `
              <div class="result-item ${result.success ? 'success' : 'failure'}">
                <div class="result-header">
                  <span class="result-status">${result.success ? '✓' : '✗'}</span>
                  <span class="result-id">${vectorId}</span>
                  <span class="result-time">${new Date(result.timestamp).toLocaleTimeString()}</span>
                </div>
                ${!result.success ? `
                  <div class="result-details">
                    <div class="error">Error: ${result.error}</div>
                    ${result.expected ? `
                      <div class="comparison">
                        <div>Expected: <code>${result.expected}</code></div>
                        <div>Actual: <code>${result.actual || 'N/A'}</code></div>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      modal.style.display = 'block';
    },
    
    // Show vector details
    showVectorDetails: function(vectorId) {
      const vector = this.findVectorById(vectorId);
      if (!vector) return;
      
      const modal = document.getElementById('test-results-modal');
      const modalBody = document.getElementById('modal-body');
      
      if (!modal || !modalBody) return;
      
      modalBody.innerHTML = `
        <div class="vector-details">
          <h4>${vector.algorithm} - ${vector.description}</h4>
          
          <div class="details-section">
            <h5>Test Data</h5>
            <div class="data-grid">
              <div class="data-item">
                <label>Input:</label>
                <code>${vector.input}</code>
              </div>
              <div class="data-item">
                <label>Key:</label>
                <code>${vector.key}</code>
              </div>
              <div class="data-item">
                <label>Expected Output:</label>
                <code>${vector.expected}</code>
              </div>
              ${vector.iv ? `
                <div class="data-item">
                  <label>IV:</label>
                  <code>${vector.iv}</code>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="details-section">
            <h5>Metadata</h5>
            <div class="metadata-grid">
              <div class="meta-item">
                <label>Category:</label>
                <span class="category-badge category-${vector.category}">${vector.category}</span>
              </div>
              <div class="meta-item">
                <label>Source:</label>
                <span class="source-badge source-${vector.source.type}">${vector.source.type}</span>
              </div>
              <div class="meta-item">
                <label>Verification Status:</label>
                <span class="status-badge status-${vector.verification.status}">${vector.verification.status}</span>
              </div>
              <div class="meta-item">
                <label>Complexity:</label>
                <span>${vector.implementation.complexity}</span>
              </div>
            </div>
          </div>
          
          <div class="details-section">
            <h5>Source Information</h5>
            <div class="source-info">
              <div><strong>Title:</strong> ${vector.source.title}</div>
              ${vector.source.identifier ? `<div><strong>Identifier:</strong> ${vector.source.identifier}</div>` : ''}
              ${vector.source.organization ? `<div><strong>Organization:</strong> ${vector.source.organization}</div>` : ''}
              ${vector.source.url ? `<div><strong>URL:</strong> <a href="${vector.source.url}" target="_blank">${vector.source.url}</a></div>` : ''}
            </div>
          </div>
          
          ${vector.implementation.notes ? `
            <div class="details-section">
              <h5>Implementation Notes</h5>
              <p>${vector.implementation.notes}</p>
            </div>
          ` : ''}
          
          <div class="details-actions">
            <button class="btn btn-primary" onclick="TestInterface.runSingleTest('${vectorId}')">Run Test</button>
            <button class="btn btn-secondary" onclick="TestInterface.copyVectorData('${vectorId}')">Copy Data</button>
          </div>
        </div>
      `;
      
      modal.style.display = 'block';
    },
    
    // Export functions
    exportResults: function() {
      const results = {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: Object.keys(this.state.testResults).length,
          passedTests: Object.values(this.state.testResults).filter(r => r.success).length,
          failedTests: Object.values(this.state.testResults).filter(r => !r.success).length
        },
        results: this.state.testResults
      };
      
      this.downloadJSON(results, `test-results-${Date.now()}.json`);
    },
    
    exportDatabase: function() {
      if (!global.TestVectorDatabase) return;
      
      const database = global.TestVectorDatabase.exportDatabase();
      this.downloadJSON(database, `test-vector-database-${Date.now()}.json`);
    },
    
    // Helper functions
    truncateText: function(text, maxLength) {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    },
    
    copyVectorData: function(vectorId) {
      const vector = this.findVectorById(vectorId);
      if (!vector) return;
      
      const data = JSON.stringify({
        algorithm: vector.algorithm,
        input: vector.input,
        key: vector.key,
        expected: vector.expected,
        description: vector.description
      }, null, 2);
      
      navigator.clipboard.writeText(data).then(() => {
        alert('Vector data copied to clipboard');
      }).catch(() => {
        alert('Failed to copy to clipboard');
      });
    },
    
    downloadJSON: function(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  // Export to global scope
  global.TestInterface = TestInterface;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);