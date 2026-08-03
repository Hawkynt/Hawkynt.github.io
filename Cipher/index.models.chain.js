/**
 * Chain Builder Model
 * Pure data model for algorithm chains: nodes, connections, execution order.
 * All rendering and DOM interaction lives in the controller.
 * (c)2006-2025 Hawkynt
 */

class ChainBuilder {
    constructor() {
        this.nodes = new Map();
        this.connections = new Map();
        this.nodeIdCounter = 0;

        this.initializeDefaultNodes();
    }

    initializeDefaultNodes() {
        // Every chain starts as Input -> ... -> Output
        this.addNode('input', {
            type: 'input',
            title: 'Input',
            x: 60,
            y: 160,
            inputs: [],
            outputs: ['output'],
            properties: { format: 'text', data: '' }
        });

        this.addNode('output', {
            type: 'output',
            title: 'Output',
            x: 620,
            y: 160,
            inputs: ['input'],
            outputs: [],
            properties: { format: 'hex' }
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
            x: config.x || 200,
            y: config.y || 100,
            properties: config.properties || {},
            algorithm: config.algorithm || null,
            inputs: config.inputs || ['input'],
            outputs: config.outputs || ['output'],
            parameters: config.parameters || []
        };

        this.nodes.set(id, node);
        return node;
    }

    /**
     * Add a connection {from, fromPort, to, toPort} (node ids + port indices).
     * Ports are exclusive: connecting to an occupied port replaces the old link,
     * which keeps every chain a simple linear path.
     */
    addConnection(id, data) {
        if (!data || data.from === data.to) return null;
        if (!this.nodes.has(data.from) || !this.nodes.has(data.to)) return null;

        for (const [connId, conn] of this.connections) {
            const samePortInUse =
                (conn.to === data.to && conn.toPort === data.toPort) ||
                (conn.from === data.from && conn.fromPort === data.fromPort);
            if (samePortInUse) {
                this.connections.delete(connId);
            }
        }

        const connection = {
            id: id || `conn_${data.from}_${data.to}_${data.fromPort}_${data.toPort}`,
            from: data.from,
            fromPort: data.fromPort || 0,
            to: data.to,
            toPort: data.toPort || 0
        };

        this.connections.set(connection.id, connection);
        return connection;
    }

    removeConnection(id) {
        return this.connections.delete(id);
    }

    removeNode(id) {
        const node = this.nodes.get(id);
        if (!node) return false;

        // Default input/output nodes are fixed endpoints
        if (node.type === 'input' || node.type === 'output') return false;

        this.nodes.delete(id);

        for (const [connId, conn] of this.connections) {
            if (conn.from === id || conn.to === id) {
                this.connections.delete(connId);
            }
        }

        return true;
    }

    clear() {
        this.nodes.clear();
        this.connections.clear();
        this.initializeDefaultNodes();
    }

    /**
     * Return the nodes on the path input -> ... -> output, in execution order.
     * Throws with a human-readable reason when the chain is not executable.
     */
    getExecutionOrder() {
        const input = this.nodes.get('input');
        const output = this.nodes.get('output');
        if (!input || !output) throw new Error('Chain is missing its input or output node');

        const order = [];
        const visited = new Set();
        let current = input;

        while (current) {
            if (visited.has(current.id)) throw new Error('Chain contains a cycle');
            visited.add(current.id);
            order.push(current);

            if (current.id === output.id) return order;

            const outgoing = [...this.connections.values()].filter(c => c.from === current.id);
            if (outgoing.length === 0) {
                throw new Error(`Node "${current.title}" is not connected onward to the output`);
            }
            current = this.nodes.get(outgoing[0].to);
        }

        throw new Error('Chain does not reach the output node');
    }

    exportChain() {
        return JSON.stringify({
            nodes: [...this.nodes.values()].map(node => ({
                ...node,
                // Algorithm objects are looked up again by name on import
                algorithm: node.algorithm ? { name: node.algorithm.name } : null
            })),
            connections: [...this.connections.values()],
            metadata: { version: '2.0' }
        }, null, 2);
    }

    /**
     * Import chain data. resolveAlgorithm(name) maps stored algorithm names
     * back to live AlgorithmFramework objects.
     */
    importChain(jsonData, resolveAlgorithm) {
        const chainData = JSON.parse(jsonData);

        this.nodes.clear();
        this.connections.clear();

        chainData.nodes.forEach(nodeData => {
            if (nodeData.algorithm && resolveAlgorithm) {
                nodeData.algorithm = resolveAlgorithm(nodeData.algorithm.name);
            }
            this.nodes.set(nodeData.id, nodeData);
        });

        chainData.connections.forEach(conn => {
            this.connections.set(conn.id, conn);
        });

        if (!this.nodes.has('input') || !this.nodes.has('output')) {
            this.clear();
            throw new Error('Invalid chain data: missing input/output nodes');
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
