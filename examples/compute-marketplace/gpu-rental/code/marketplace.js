const EventEmitter = require('events');

class ComputeProvider extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.activeSessions = new Map();
        this.resourcePool = new Map();
        this.utilization = 0;
    }

    async registerProvider(provider) {
        // Register a compute provider with the marketplace
        this.resourcePool.set(provider.id, provider);
        console.log(`Registered provider: ${provider.id} with ${provider.gpuCount} GPUs`);

        this.emit('providerRegistered', provider);
    }

    async discoverResources(criteria = {}) {
        // Discover available compute resources matching criteria
        const availableResources = [];

        for (const [id, provider] of this.resourcePool) {
            if (this.meetsCriteria(provider, criteria)) {
                const capacity = this.getAvailableCapacity(provider);
                if (capacity > 0) {
                    availableResources.push({
                        providerId: id,
                        type: 'gpu',
                        gpuCount: capacity,
                        pricePerHour: provider.pricing?.baseRate || 5.00,
                        availability: provider.availability,
                        location: provider.location || 'local',
                        latency: this.estimateLatency(provider),
                        reputation: provider.reputation || 0.8
                    });
                }
            }
        }

        // Sort by preference criteria (price, latency, reputation)
        return this.sortResources(availableResources, criteria);
    }

    meetsCriteria(provider, criteria) {
        // Check if provider meets search criteria
        if (criteria.minGPUs && provider.gpuCount < criteria.minGPUs) {
            return false;
        }

        if (criteria.maxPrice && provider.pricing?.baseRate > criteria.maxPrice) {
            return false;
        }

        if (criteria.trustLevel && (provider.reputation || 0) < criteria.trustLevel) {
            return false;
        }

        return true;
    }

    getAvailableCapacity(provider) {
        // Calculate available GPU capacity
        const activeSessions = Array.from(this.activeSessions.values())
            .filter(session => session.providerId === provider.id);

        const usedGPUs = activeSessions.reduce((sum, session) => sum + session.gpuCount, 0);

        return Math.max(0, provider.gpuCount - usedGPUs);
    }

    estimateLatency(provider) {
        // Estimate network latency to provider
        if (provider.location === 'local') {
            return 1; // 1ms local
        } else if (provider.location === 'campus') {
            return 5; // 5ms campus network
        } else {
            return 50; // 50ms remote
        }
    }

    sortResources(resources, criteria) {
        // Sort resources based on preference criteria
        return resources.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // Price weighting (lower is better)
            if (criteria.priorityPrice) {
                scoreA += (1 / a.pricePerHour) * criteria.priorityPrice;
                scoreB += (1 / b.pricePerHour) * criteria.priorityPrice;
            }

            // Latency weighting (lower is better)
            if (criteria.priorityLatency) {
                scoreA += (1 / a.latency) * criteria.priorityLatency;
                scoreB += (1 / b.latency) * criteria.priorityLatency;
            }

            // Reputation weighting (higher is better)
            if (criteria.priorityReputation) {
                scoreA += a.reputation * criteria.priorityReputation;
                scoreB += b.reputation * criteria.priorityReputation;
            }

            return scoreB - scoreA;
        });
    }

    async allocateResource(request) {
        // Allocate resources based on request
        const availableResources = await this.discoverResources({
            minGPUs: request.gpuCount,
            maxPrice: request.maxPrice,
            trustLevel: request.trustLevel
        });

        if (availableResources.length === 0) {
            throw new Error('No available resources meet criteria');
        }

        const selectedResource = availableResources[0];
        const session = {
            sessionId: this.generateSessionId(),
            providerId: selectedResource.providerId,
            userId: request.userId,
            gpuCount: request.gpuCount,
            startTime: new Date(),
            estimatedDuration: request.duration,
            actualCost: selectedResource.pricePerHour * request.gpuCount * request.duration,
            status: 'active'
        };

        this.activeSessions.set(session.sessionId, session);
        this.updateUtilization();

        this.emit('resourceAllocated', session);
        return session;
    }

    async releaseResource(sessionId) {
        // Release allocated resources
        const session = this.activeSessions.get(sessionId);

        if (!session) {
            throw new Error('Session not found');
        }

        session.status = 'completed';
        session.endTime = new Date();

        this.activeSessions.delete(sessionId);
        this.updateUtilization();

        this.emit('resourceReleased', session);
        return session;
    }

    generateSessionId() {
        // Generate unique session ID
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateUtilization() {
        // Update overall system utilization
        const totalGPUs = Array.from(this.resourcePool.values())
            .reduce((sum, provider) => sum + provider.gpuCount, 0);

        const usedGPUs = Array.from(this.activeSessions.values())
            .reduce((sum, session) => sum + session.gpuCount, 0);

        this.utilization = totalGPUs > 0 ? (usedGPUs / totalGPUs) * 100 : 0;
    }

    getUtilization() {
        return this.utilization;
    }

    getSessionStats() {
        const active = Array.from(this.activeSessions.values());
        const totalGPUs = active.reduce((sum, session) => sum + session.gpuCount, 0);
        const totalCost = active.reduce((sum, session) => sum + session.actualCost, 0);

        return {
            activeSessions: active.length,
            totalGPUsAllocated: totalGPUs,
            averageUtilization: this.utilization,
            totalEstimatedRevenue: totalCost,
            averageSessionDuration: active.length > 0 ?
                active.reduce((sum, session) => sum + session.estimatedDuration, 0) / active.length : 0
        };
    }
}

module.exports = ComputeProvider;