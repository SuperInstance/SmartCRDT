const EventEmitter = require('events');
const HealthMonitor = require('./monitor');
const CostOptimizer = require('./costOptimizer');

class HybridRouter extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.healthMonitor = new HealthMonitor(config.monitoring);
        this.costOptimizer = new CostOptimizer(config.optimization);
        this.routingStrategy = config.routingStrategy || 'cost_performance_balance';
        this.activeConnections = new Map();
        this.routingHistory = [];
        this.currentStrategy = this.routingStrategy;
    }

    initialize() {
        // Initialize compute sources
        this.computeSources = {
            local: this.initializeComputeSource('local'),
            cloud: this.initializeComputeSource('cloud'),
            remote: this.initializeComputeSource('remote')
        };

        // Start monitoring
        this.healthMonitor.start();

        // Set up event listeners
        this.healthMonitor.on('sourceHealthUpdate', (update) => {
            this.updateComputeSourceHealth(update);
        });

        this.costOptimizer.on('costOptimization', (optimization) => {
            this.applyCostOptimization(optimization);
        });

        console.log('Hybrid Router initialized with strategy:', this.currentStrategy);
    }

    initializeComputeSource(type) {
        const sourceConfig = this.config.computeSources[type];
        return {
            type,
            name: sourceConfig.name,
            gpuCount: sourceConfig.gpu_count,
            gpuType: sourceConfig.gpu_type,
            memoryPerGpu: sourceConfig.memory_per_gpu,
            costPerHour: sourceConfig.cost_per_hour,
            baseLatency: sourceConfig.latency_ms,
            priority: sourceConfig.priority,
            useCases: sourceConfig.use_cases || [],
            restrictions: sourceConfig.restrictions || [],
            status: 'unknown',
            health: {
                availability: 0,
                latency: sourceConfig.latency_ms,
                throughput: 0,
                errorRate: 0
            },
            currentLoad: 0,
            availableCapacity: sourceConfig.gpu_count,
            allocatedJobs: [],
            reservations: sourceConfig.reserved_hours || 0,
            location: sourceConfig.location || 'unknown'
        };
    }

    async routeRequest(request) {
        // Process routing request and return optimal compute source
        try {
            console.log(`Routing request: ${request.id} for ${request.modelType} model`);

            // Check eligibility for each compute source
            const eligibleSources = await this.getEligibleSources(request);

            if (eligibleSources.length === 0) {
                throw new Error('No eligible compute sources available');
            }

            // Apply routing strategy
            const selectedSource = await this.applyRoutingStrategy(eligibleSources, request);

            // Reserve capacity
            const reservation = await this.reserveCapacity(selectedSource, request);

            // Create connection
            const connection = await this.createConnection(selectedSource, request, reservation);

            // Store active connection
            this.activeConnections.set(request.id, connection);

            // Log routing decision
            this.logRoutingDecision(request, selectedSource);

            this.emit('routeSuccess', { request, source: selectedSource, connection });

            return {
                success: true,
                source: selectedSource,
                connection,
                estimatedCost: this.estimateCost(selectedSource, request),
                estimatedLatency: selectedSource.health.latency,
                reliability: selectedSource.health.availability
            };

        } catch (error) {
            console.error(`Routing failed for request ${request.id}:`, error.message);
            this.emit('routeFailure', { request, error });
            throw error;
        }
    }

    async getEligibleSources(request) {
        const eligible = [];

        for (const [type, source] of Object.entries(this.computeSources)) {
            // Check basic requirements
            if (source.status !== 'healthy') continue;

            // Check capacity
            if (source.availableCapacity < request.gpuCount) continue;

            // Check model compatibility
            if (!this.isModelCompatible(request.modelType, source)) continue;

            // Check use case restrictions
            if (!this.isUseCaseAllowed(request.useCase, source)) continue;

            // Check data locality requirements
            if (!this.checkDataLocality(request.dataLocation, source)) continue;

            // Check SLA requirements
            if (!this.checkSLACompliance(request.sla, source)) continue;

            // Add source to eligible list
            eligible.push({
                type,
                source,
                score: 0 // Will be calculated by routing strategy
            });
        }

        return eligible;
    }

    isModelCompatible(modelType, source) {
        // Basic model compatibility check
        const modelRequirements = {
            'transformer-xlarge': ['A100', 'V100', 'RTX4090'],
            'transformer-large': ['V100', 'RTX4090', 'A100'],
            'transformer-base': ['RTX4090', 'V100', 'A100'],
            'vision-large': ['A100', 'V100', 'RTX4090'],
            'vision-base': ['V100', 'RTX4090'],
            'nlp-large': ['A100', 'V100'],
            'nlp-base': ['V100', 'RTX4090'],
            'small': ['RTX4090', 'V100']
        };

        const compatibleGpus = modelRequirements[modelType] || ['RTX4090'];
        return compatibleGpus.includes(source.gpuType);
    }

    isUseCaseAllowed(useCase, source) {
        return source.useCases.includes(useCase) || source.useCases.includes('general');
    }

    checkDataLocality(dataLocation, source) {
        // Check if data location matches compute source requirements
        if (!dataLocation) return true;

        if (dataLocation === 'local' && source.type !== 'local') {
            console.warn('Data marked local but requesting remote compute');
            return false;
        }

        return true;
    }

    checkSLACompliance(sla, source) {
        if (!sla) return true;

        // Check latency SLA
        if (sla.maxLatency && source.health.latency > sla.maxLatency) {
            return false;
        }

        // Check uptime SLA
        if (sla.minUptime && source.health.availability < sla.minUptime) {
            return false;
        }

        // Check throughput SLA
        if (sla.minThroughput && source.health.throughput < sla.minThroughput) {
            return false;
        }

        return true;
    }

    async applyRoutingStrategy(sources, request) {
        switch (this.currentStrategy) {
            case 'lowest_cost':
                return this.applyLowestCostStrategy(sources, request);

            case 'lowest_latency':
                return this.applyLowestLatencyStrategy(sources, request);

            case 'highest_reliability':
                return this.applyHighestReliabilityStrategy(sources, request);

            case 'cost_performance_balance':
            default:
                return this.applyCostPerformanceStrategy(sources, request);

            case 'energy_aware':
                return this.applyEnergyAwareStrategy(sources, request);

            case 'hybrid_optimization':
                return this.applyHybridOptimizationStrategy(sources, request);
        }
    }

    applyLowestCostStrategy(sources, request) {
        return sources.reduce((cheapest, current) => {
            const currentCost = current.source.costPerHour * request.duration * request.gpuCount;
            const cheapestCost = cheapest.source.costPerHour * request.duration * cheapest.source.gpuCount;
            return currentCost < cheapestCost ? current : cheapest;
        });
    }

    applyLowestLatencyStrategy(sources, request) {
        return sources.reduce((fastest, current) => {
            return current.source.health.latency < fastest.source.health.latency ? current : fastest;
        });
    }

    applyHighestReliabilityStrategy(sources, request) {
        return sources.reduce((mostReliable, current) => {
            return current.source.health.availability > mostReliable.source.health.availability ? current : mostReliable;
        });
    }

    applyCostPerformanceStrategy(sources, request) {
        // Balance cost and performance with configurable weights
        const costWeight = this.config.optimization.costWeight || 0.4;
        const latencyWeight = this.config.optimization.latencyWeight || 0.3;
        const reliabilityWeight = this.config.optimization.reliabilityWeight || 0.3;

        return sources.reduce((best, current) => {
            const costScore = 1 / (current.source.costPerHour + 0.01);
            const latencyScore = 1 / (current.source.health.latency + 1);
            const reliabilityScore = current.source.health.availability;

            const totalScore = (costScore * costWeight +
                               latencyScore * latencyWeight +
                               reliabilityScore * reliabilityWeight);

            current.score = totalScore;
            return totalScore > best.score ? current : best;
        }, { score: -1 });
    }

    applyEnergyAwareStrategy(sources, request) {
        // Prefer local compute to reduce energy consumption
        const sourcesWithEnergyScores = sources.map(source => {
            let energyScore = 1;

            // Local compute gets energy bonus
            if (source.type === 'local') {
                energyScore *= 1.5;
            }

            // Cloud gets energy penalty
            if (source.type === 'cloud') {
                energyScore *= 0.7;
            }

            // Apply energy cost to total score
            const costScore = 1 / (source.source.costPerHour + 0.01);
            source.score = costScore * energyScore;

            return source;
        });

        return sourcesWithEnergyScores.reduce((best, current) =>
            current.score > best.score ? current : best
        );
    }

    applyHybridOptimizationStrategy(sources, request) {
        // Advanced optimization considering multiple factors
        return sources.reduce((best, current) => {
            let score = 0;

            // Base cost factor
            score += 1 / (current.source.costPerHour + 0.01);

            // Performance factor
            score += 1 / (current.source.health.latency + 1);
            score += current.source.health.availability;
            score += current.source.health.throughput;

            // Capacity factor
            const utilization = current.source.currentLoad / current.source.gpuCount;
            const capacityScore = 1 - utilization;
            score += capacityScore;

            // Special bonuses
            if (current.type === 'local' && request.useCase === 'development') {
                score *= 2; // Strong preference for local dev work
            }

            if (current.type === 'remote' && request.priority === 'cost_sensitive') {
                score *= 1.5; // Preference for remote for cost-sensitive work
            }

            current.score = score;
            return score > best.score ? current : best;
        }, { score: -1 });
    }

    async reserveCapacity(source, request) {
        // Reserve capacity on the selected compute source
        const reservation = {
            id: this.generateReservationId(),
            sourceType: source.type,
            requestId: request.id,
            gpuCount: request.gpuCount,
            duration: request.duration,
            startTime: new Date(),
            estimatedCost: this.estimateCost(source, request),
            status: 'reserved'
        };

        // Update source capacity
        source.availableCapacity -= request.gpuCount;
        source.currentLoad += request.gpuCount;
        source.allocatedJobs.push(request.id);

        console.log(`Reserved ${request.gpuCount} GPUs on ${source.type} for request ${request.id}`);

        return reservation;
    }

    async createConnection(source, request, reservation) {
        // Create connection to compute source
        const connection = {
            id: this.generateConnectionId(),
            reservation,
            source,
            request,
            status: 'active',
            metrics: {
                startTime: new Date(),
                dataTransferred: 0,
                computeTime: 0,
                energyConsumed: 0
            }
        };

        console.log(`Created connection ${connection.id} to ${source.type} compute`);

        return connection;
    }

    async releaseConnection(connectionId) {
        // Release capacity and close connection
        const connection = this.activeConnections.get(connectionId);

        if (!connection) {
            throw new Error('Connection not found');
        }

        // Update source capacity
        const source = connection.source;
        source.availableCapacity += connection.request.gpuCount;
        source.currentLoad -= connection.request.gpuCount;

        // Remove from allocated jobs
        const jobIndex = source.allocatedJobs.indexOf(connection.request.id);
        if (jobIndex > -1) {
            source.allocatedJobs.splice(jobIndex, 1);
        }

        // Update connection metrics
        connection.status = 'completed';
        connection.endTime = new Date();

        // Store in history
        this.routingHistory.push(connection);

        // Remove from active connections
        this.activeConnections.delete(connectionId);

        console.log(`Released connection ${connectionId} from ${source.type}`);

        this.emit('connectionReleased', connection);

        return connection;
    }

    estimateCost(source, request) {
        const baseCost = source.costPerHour * request.gpuCount * request.duration;
        const discount = this.costOptimizer.calculateDiscount(source, request);
        return baseCost * (1 - discount);
    }

    logRoutingDecision(request, source) {
        const logEntry = {
            timestamp: new Date(),
            requestId: request.id,
            strategy: this.currentStrategy,
            selectedSource: source.type,
            cost: source.costPerHour,
            latency: source.health.latency,
            reliability: source.health.availability,
            factors: this.getRoutingFactors(source)
        };

        console.log('Routing decision:', JSON.stringify(logEntry, null, 2));
    }

    getRoutingFactors(source) {
        return {
            cost: source.costPerHour,
            latency: source.health.latency,
            reliability: source.health.availability,
            capacity: source.availableCapacity,
            location: source.location,
            priority: source.priority
        };
    }

    updateComputeSourceHealth(update) {
        const source = this.computeSources[update.type];
        if (source) {
            source.health = { ...source.health, ...update.health };
            source.status = update.status;
            console.log(`Updated health for ${update.type}:`, update.health);
        }
    }

    applyCostOptimization(optimization) {
        // Apply cost optimization strategies
        if (optimization.strategy === 'shift_to_local') {
            this.currentStrategy = 'energy_aware';
        } else if (optimization.strategy === 'use_reserved_capacity') {
            this.adjustForReservedCapacity();
        } else if (optimization.strategy === 'prioritize_low_cost') {
            this.currentStrategy = 'lowest_cost';
        }

        console.log(`Applied optimization: ${optimization.strategy}`);
    }

    adjustForReservedCapacity() {
        // Adjust routing to maximize use of reserved capacity
        const cloud = this.computeSources.cloud;
        if (cloud.reservations > 0) {
            console.log(`Adjusting to use ${cloud.reservations} hours of reserved capacity`);
        }
    }

    generateReservationId() {
        return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getRoutingStatistics() {
        const totalRequests = this.routingHistory.length + this.activeConnections.size;
        const completedRequests = this.routingHistory.length;

        const sourceUsage = {};
        Object.entries(this.computeSources).forEach(([type, source]) => {
            sourceUsage[type] = {
                totalAllocated: source.allocatedJobs.length,
                currentCapacity: source.availableCapacity,
                totalCapacity: source.gpuCount,
                utilization: (source.currentLoad / source.gpuCount) * 100,
                averageLatency: source.health.latency
            };
        });

        return {
            totalRequests,
            activeConnections: this.activeConnections.size,
            completedRequests,
            currentStrategy: this.currentStrategy,
            sourceUsage,
            averageCost: this.calculateAverageCost(),
            averageLatency: this.calculateAverageLatency()
        };
    }

    calculateAverageCost() {
        const recentRoutes = this.routingHistory.slice(-50); // Last 50 routes
        if (recentRoutes.length === 0) return 0;

        const totalCost = recentRoutes.reduce((sum, route) => {
            return sum + (route.source.costPerHour * route.request.gpuCount * route.request.duration);
        }, 0);

        return totalCost / recentRoutes.length;
    }

    calculateAverageLatency() {
        const recentRoutes = this.routingHistory.slice(-50);
        if (recentRoutes.length === 0) return 0;

        const totalLatency = recentRoutes.reduce((sum, route) => {
            return sum + route.source.health.latency;
        }, 0);

        return totalLatency / recentRoutes.length;
    }

    changeRoutingStrategy(newStrategy) {
        if (Object.keys(this.getAvailableStrategies()).includes(newStrategy)) {
            this.currentStrategy = newStrategy;
            console.log(`Routing strategy changed to: ${newStrategy}`);
            this.emit('strategyChanged', { strategy: newStrategy });
        } else {
            throw new Error(`Unknown strategy: ${newStrategy}`);
        }
    }

    getAvailableStrategies() {
        return {
            lowest_cost: 'Minimize cost',
            lowest_latency: 'Minimize latency',
            highest_reliability: 'Maximize reliability',
            cost_performance_balance: 'Balance cost and performance',
            energy_aware: 'Prefer energy-efficient local compute',
            hybrid_optimization: 'Advanced multi-factor optimization'
        };
    }
}

// Example usage
if (require.main === module) {
    const config = {
        routingStrategy: 'cost_performance_balance',
        monitoring: {
            interval: 30000, // 30 seconds
            healthChecks: true
        },
        optimization: {
            costWeight: 0.4,
            latencyWeight: 0.3,
            reliabilityWeight: 0.3
        },
        computeSources: {
            local: {
                name: "Office RTX 4090",
                gpu_count: 4,
                gpu_type: "RTX4090",
                memory_per_gpu: 24,
                cost_per_hour: 0,
                latency_ms: 1,
                priority: 1,
                use_cases: ["development", "testing", "small_production"],
                location: "local"
            },
            cloud: {
                name: "AWS A100 Reserved",
                gpu_count: 8,
                gpu_type: "A100",
                memory_per_gpu: 80,
                cost_per_hour: 8.00,
                latency_ms: 50,
                priority: 2,
                use_cases: ["production", "large_training"],
                location: "cloud",
                reserved_hours: 160
            },
            remote: {
                name: "University Partnership",
                gpu_count: 16,
                gpu_type: "V100",
                memory_per_gpu: 32,
                cost_per_hour: 3.00,
                latency_ms: 100,
                priority: 3,
                use_cases: ["training", "batch_processing"],
                restrictions: ["non-commercial"],
                location: "remote"
            }
        }
    };

    const router = new HybridRouter(config);

    async function demo() {
        console.log('=== Hybrid Router Demo ===\n');

        try {
            router.initialize();

            // Simulate routing requests
            const requests = [
                { id: 'dev-1', modelType: 'transformer-base', useCase: 'development', gpuCount: 1, duration: 2 },
                { id: 'prod-1', modelType: 'transformer-xlarge', useCase: 'production', gpuCount: 4, duration: 8 },
                { id: 'train-1', modelType: 'vision-large', useCase: 'training', gpuCount: 2, duration: 12, priority: 'cost_sensitive' }
            ];

            for (const request of requests) {
                console.log(`\n--- Routing request ${request.id} ---`);
                const result = await router.routeRequest(request);
                console.log('Routing result:', {
                    source: result.source.type,
                    cost: `$${result.estimatedCost.toFixed(2)}`,
                    latency: `${result.estimatedLatency}ms`,
                    reliability: `${(result.reliability * 100).toFixed(1)}%`
                });

                // Simulate execution time
                setTimeout(() => {
                    router.releaseConnection(request.id);
                }, request.duration * 1000);
            }

            // Show routing statistics
            setTimeout(() => {
                console.log('\n--- Routing Statistics ---');
                const stats = router.getRoutingStatistics();
                console.log(JSON.stringify(stats, null, 2));
            }, 5000);

        } catch (error) {
            console.error('Demo failed:', error.message);
        }
    }

    demo();
}

module.exports = HybridRouter;