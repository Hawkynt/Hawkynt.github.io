/**
 * Chain Builder Model
 * Manages algorithm chaining, nodes, and connections
 * (c)2006-2025 Hawkynt
 */

class ChainBuilder {
    constructor() {
        this.nodes = new Map();
        this.connections = new Map();
        this.selectedNode = null;
        this.draggedNode = null;
        this.connecting = false;
        this.connectionStart = null;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.nodeIdCounter = 0;
        
        this.setupEventListeners();
        this.initializeDefaultNodes();
    }
    
    setupEventListeners() {
        const canvas = document.getElementById('chain-canvas');
        const canvasInner = document.getElementById('chain-canvas-inner');
        
        if (!canvas || !canvasInner) return;
        
        // Pan and zoom
        canvas.addEventListener('wheel', (e) => this.handleZoom(e));
        canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        
        // Zoom controls
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const resetBtn = document.getElementById('reset-chain');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetChain());
    }
    
    initializeDefaultNodes() {
        // Always include input and output nodes
        this.addNode('input', {
            type: 'input',
            title: 'File Input',
            x: 100,
            y: 200,
            properties: {
                fileType: 'auto-detect',
                maxSize: '50MB'
            }
        });
        
        this.addNode('output', {
            type: 'output', 
            title: 'File Output',
            x: 700,
            y: 200,
            properties: {
                format: 'original',
                filename: 'processed_file'
            }
        });
    }
    
    addNode(id, config) {
        if (!id) {
            id = `node_${this.nodeIdCounter++}`;
        }
        
        const node = {
            id,
            type: config.type || 'algorithm',
            title: config.title || 'Untitled',
            x: config.x || Math.random() * 400 + 200,
            y: config.y || Math.random() * 200 + 100,
            properties: config.properties || {},
            algorithm: config.algorithm || null,
            inputs: config.inputs || ['input'],
            outputs: config.outputs || ['output'],
            parameters: config.parameters || []
        };
        
        this.nodes.set(id, node);
        this.renderNode(node);
        return id;
    }
    
    renderNode(node) {
        const canvasInner = document.getElementById('chain-canvas-inner');
        if (!canvasInner) return;
        
        const nodeEl = document.createElement('div');
        nodeEl.className = `chain-node node-${node.type}`;
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;
        nodeEl.setAttribute('data-node-id', node.id);
        
        // Set category color if it's an algorithm node
        if (node.algorithm && node.algorithm.category) {
            nodeEl.setAttribute('data-category', node.algorithm.category);
        }
        
        nodeEl.innerHTML = `
            <div class="node-type">${node.type}</div>
            <div class="node-header">${node.title}</div>
            ${this.renderNodeConnections(node)}
        `;
        
        this.setupNodeEventListeners(nodeEl, node);
        canvasInner.appendChild(nodeEl);
    }
    
    renderNodeConnections(node) {
        let html = '';
        
        // Input connections
        node.inputs.forEach((input, index) => {
            html += `<div class="connection-point input" data-type="input" data-index="${index}"></div>`;
        });
        
        // Output connections
        node.outputs.forEach((output, index) => {
            html += `<div class="connection-point output" data-type="output" data-index="${index}"></div>`;
        });
        
        // Parameter connections
        node.parameters.forEach((param, index) => {
            html += `<div class="connection-point parameter" data-type="parameter" data-index="${index}" title="${param}"></div>`;
        });
        
        return html;
    }
    
    setupNodeEventListeners(nodeEl, node) {
        // Node dragging
        nodeEl.addEventListener('mousedown', (e) => this.handleNodeMouseDown(e, node));
        
        // Connection points
        const connectionPoints = nodeEl.querySelectorAll('.connection-point');
        connectionPoints.forEach(point => {
            point.addEventListener('mousedown', (e) => this.handleConnectionStart(e, node, point));
            point.addEventListener('mouseup', (e) => this.handleConnectionEnd(e, node, point));
            point.addEventListener('mouseenter', (e) => this.handleConnectionHover(e, point));
            point.addEventListener('mouseleave', (e) => this.handleConnectionLeave(e, point));
        });
    }
    
    handleZoom(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(0.1, Math.min(3, this.zoom * zoomFactor));
        this.updateCanvasTransform();
    }
    
    handleCanvasMouseDown(e) {
        if (e.target.classList.contains('chain-canvas') || e.target.classList.contains('chain-canvas-inner')) {
            this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
            this.panning = true;
        }
    }
    
    handleCanvasMouseMove(e) {
        if (this.panning && this.panStart) {
            this.panX = e.clientX - this.panStart.x;
            this.panY = e.clientY - this.panStart.y;
            this.updateCanvasTransform();
        }
        
        if (this.draggedNode) {
            const rect = document.getElementById('chain-canvas-inner').getBoundingClientRect();
            this.draggedNode.x = (e.clientX - rect.left - this.panX) / this.zoom;
            this.draggedNode.y = (e.clientY - rect.top - this.panY) / this.zoom;
            this.updateNodePosition(this.draggedNode);
        }
    }
    
    handleCanvasMouseUp(e) {
        this.panning = false;
        this.panStart = null;
        this.draggedNode = null;
        
        // Clear dragging classes
        document.querySelectorAll('.chain-node.dragging').forEach(node => {
            node.classList.remove('dragging');
        });
    }
    
    handleNodeMouseDown(e, node) {
        if (e.target.classList.contains('connection-point')) return;
        
        e.stopPropagation();
        this.draggedNode = node;
        this.selectedNode = node;
        
        // Update visual states
        document.querySelectorAll('.chain-node').forEach(n => n.classList.remove('selected'));
        const nodeEl = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeEl) {
            nodeEl.classList.add('selected', 'dragging');
        }
    }
    
    handleConnectionStart(e, node, point) {
        e.stopPropagation();
        this.connecting = true;
        this.connectionStart = { node, point };
        point.classList.add('connecting');
    }
    
    handleConnectionEnd(e, node, point) {
        if (this.connecting && this.connectionStart) {
            this.createConnection(this.connectionStart, { node, point });
            this.connecting = false;
            this.connectionStart = null;
            
            // Clear connecting classes
            document.querySelectorAll('.connection-point.connecting').forEach(p => {
                p.classList.remove('connecting');
            });
        }
    }
    
    handleConnectionHover(e, point) {
        if (this.connecting) {
            point.classList.add('connection-target');
        }
    }
    
    handleConnectionLeave(e, point) {
        point.classList.remove('connection-target');
    }
    
    createConnection(start, end) {
        // Validate connection (output to input, etc.)
        if (!this.isValidConnection(start, end)) return;
        
        const connectionId = `${start.node.id}_${start.point.dataset.type}_${start.point.dataset.index}_to_${end.node.id}_${end.point.dataset.type}_${end.point.dataset.index}`;
        
        const connection = {
            id: connectionId,
            from: {
                nodeId: start.node.id,
                type: start.point.dataset.type,
                index: parseInt(start.point.dataset.index)
            },
            to: {
                nodeId: end.node.id,
                type: end.point.dataset.type,
                index: parseInt(end.point.dataset.index)
            }
        };
        
        this.connections.set(connectionId, connection);
        this.renderConnection(connection);
    }
    
    isValidConnection(start, end) {
        // Can't connect to same node
        if (start.node.id === end.node.id) return false;
        
        // Output to input connections
        if (start.point.dataset.type === 'output' && end.point.dataset.type === 'input') return true;
        
        // Parameter connections (bidirectional)
        if (start.point.dataset.type === 'parameter' || end.point.dataset.type === 'parameter') return true;
        
        return false;
    }
    
    renderConnection(connection) {
        const svg = this.getOrCreateConnectionSVG();
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        line.setAttribute('class', `connection-line ${connection.from.type === 'parameter' || connection.to.type === 'parameter' ? 'parameter' : ''}`);
        line.setAttribute('data-connection-id', connection.id);
        
        this.updateConnectionPath(line, connection);
        svg.appendChild(line);
    }
    
    getOrCreateConnectionSVG() {
        let svg = document.getElementById('connection-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'connection-svg';
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '2000px';
            svg.style.height = '2000px';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1';
            
            const canvasInner = document.getElementById('chain-canvas-inner');
            if (canvasInner) {
                canvasInner.appendChild(svg);
            }
        }
        return svg;
    }
    
    updateConnectionPath(line, connection) {
        const fromPoint = this.getConnectionPointPosition(connection.from);
        const toPoint = this.getConnectionPointPosition(connection.to);
        
        if (!fromPoint || !toPoint) return;
        
        // Create smooth bezier curve
        const dx = toPoint.x - fromPoint.x;
        const dy = toPoint.y - fromPoint.y;
        const cp1x = fromPoint.x + dx * 0.5;
        const cp1y = fromPoint.y;
        const cp2x = toPoint.x - dx * 0.5;
        const cp2y = toPoint.y;
        
        const path = `M ${fromPoint.x} ${fromPoint.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPoint.x} ${toPoint.y}`;
        line.setAttribute('d', path);
    }
    
    getConnectionPointPosition(connectionInfo) {
        const nodeEl = document.querySelector(`[data-node-id="${connectionInfo.nodeId}"]`);
        if (!nodeEl) return null;
        
        const points = nodeEl.querySelectorAll(`.connection-point[data-type="${connectionInfo.type}"]`);
        const point = points[connectionInfo.index];
        if (!point) return null;
        
        const nodeRect = nodeEl.getBoundingClientRect();
        const pointRect = point.getBoundingClientRect();
        const canvasRect = document.getElementById('chain-canvas-inner').getBoundingClientRect();
        
        return {
            x: pointRect.left + pointRect.width / 2 - canvasRect.left,
            y: pointRect.top + pointRect.height / 2 - canvasRect.top
        };
    }
    
    updateCanvasTransform() {
        const canvasInner = document.getElementById('chain-canvas-inner');
        if (canvasInner) {
            canvasInner.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        }
        
        // Update zoom level display
        const zoomDisplay = document.querySelector('.zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }
    
    updateNodePosition(node) {
        const nodeEl = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeEl) {
            nodeEl.style.left = `${node.x}px`;
            nodeEl.style.top = `${node.y}px`;
        }
        
        // Update connections involving this node
        this.connections.forEach(connection => {
            if (connection.from.nodeId === node.id || connection.to.nodeId === node.id) {
                const line = document.querySelector(`[data-connection-id="${connection.id}"]`);
                if (line) {
                    this.updateConnectionPath(line, connection);
                }
            }
        });
    }
    
    zoomIn() {
        this.zoom = Math.min(3, this.zoom * 1.2);
        this.updateCanvasTransform();
    }
    
    zoomOut() {
        this.zoom = Math.max(0.1, this.zoom / 1.2);
        this.updateCanvasTransform();
    }
    
    resetChain() {
        // Clear all connections
        this.connections.clear();
        const svg = document.getElementById('connection-svg');
        if (svg) {
            svg.innerHTML = '';
        }
        
        // Reset zoom and pan
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateCanvasTransform();
        
        // Reset to default nodes only
        const canvasInner = document.getElementById('chain-canvas-inner');
        if (canvasInner) {
            canvasInner.innerHTML = '';
        }
        
        this.nodes.clear();
        this.initializeDefaultNodes();
    }
    
    exportChain() {
        const chainData = {
            nodes: Array.from(this.nodes.values()),
            connections: Array.from(this.connections.values()),
            metadata: {
                created: new Date().toISOString(),
                version: '1.0'
            }
        };
        
        return JSON.stringify(chainData, null, 2);
    }
    
    importChain(jsonData) {
        try {
            const chainData = JSON.parse(jsonData);
            
            // Clear existing chain
            this.resetChain();
            
            // Import nodes
            chainData.nodes.forEach(nodeData => {
                this.nodes.set(nodeData.id, nodeData);
                this.renderNode(nodeData);
            });
            
            // Import connections
            chainData.connections.forEach(connectionData => {
                this.connections.set(connectionData.id, connectionData);
                this.renderConnection(connectionData);
            });
            
        } catch (error) {
            console.error('Failed to import chain:', error);
            throw new Error('Invalid chain data format');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChainBuilder;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
    window.ChainBuilder = ChainBuilder;
}