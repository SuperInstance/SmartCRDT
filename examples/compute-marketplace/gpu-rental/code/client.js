const ComputeProvider = require('./marketplace');
const Billing = require('./billing');

class ComputeClient {
    constructor(config) {
        this.config = config;
        this.marketplace = new ComputeProvider(config);
        this.billing = new Billing(config.billing);
        this.activeSessions = new Map();
        this.userPreferences = config.userPreferences || {};
    }

    async searchComputeResources(criteria) {
        // Search for available compute resources
        const searchCriteria = {
            minGPUs: criteria.gpuCount || 1,
            maxPrice: criteria.maxPrice || 10.00,
            priorityPrice: criteria.priorityPrice || 0.5,
            priorityLatency: criteria.priorityLatency || 0.3,
            priorityReputation: criteria.priorityReputation || 0.2,
            trustLevel: this.userPreferences.trustLevel || 0.5,
            ...criteria
        };

        const resources = await this.marketplace.discoverResources(searchCriteria);

        console.log(`Found ${resources.length} available resource options:`);
        resources.forEach((resource, index) => {
            console.log(`${index + 1}. ${resource.providerId} - ${resource.gpuCount} GPUs at $${resource.pricePerHour}/hr`);
            console.log(`   Location: ${resource.location}, Latency: ${resource.latency}ms`);
            console.log(`   Total cost: $${(resource.pricePerHour * criteria.duration * resource.gpuCount).toFixed(2)}`);
        });

        return resources;
    }

    async requestCompute(request) {
        // Request compute resources
        const allocationRequest = {
            userId: this.userPreferences.userId || 'anonymous',
            gpuCount: request.gpuCount,
            duration: request.duration,
            maxPrice: request.maxPrice || 10.00,
            priorityLatency: request.priorityLatency || 0.3,
            priorityPrice: request.priorityPrice || 0.5,
            priorityReputation: request.priorityReputation || 0.2
        };

        try {
            const session = await this.marketplace.allocateResource(allocationRequest);
            this.activeSessions.set(session.sessionId, session);

            console.log(`✓ Compute resources allocated:`);
            console.log(`  Session ID: ${session.sessionId}`);
            console.log(`  Provider: ${session.providerId}`);
            console.log(`  GPUs: ${session.gpuCount}`);
            console.log(`  Duration: ${session.estimatedDuration} hours`);
            console.log(`  Cost: $${session.actualCost.toFixed(2)}`);

            return session;
        } catch (error) {
            console.error(`✗ Allocation failed: ${error.message}`);
            throw error;
        }
    }

    async executeTask(task, session) {
        // Execute a computational task on allocated resources
        console.log(`Executing task: ${task.name}`);

        // Simulate task execution
        const startTime = Date.now();

        // In real implementation, this would connect to the actual GPU resources
        // and execute the task (e.g., model inference, data processing)
        await this.simulateTaskExecution(task);

        const endTime = Date.now();
        const durationMs = endTime - startTime;

        // Update session with actual usage
        await this.marketplace.updateSessionUsage(session.sessionId, {
            duration: durationMs / (1000 * 60 * 60), // Convert to hours
            taskCompleted: true,
            results: task.results || {}
        });

        const result = {
            task,
            session,
            duration: durationMs,
            startTime,
            endTime,
            success: true
        };

        console.log(`✓ Task completed in ${(durationMs / 1000).toFixed(2)} seconds`);
        return result;
    }

    async simulateTaskExecution(task) {
        // Simulate GPU task execution
        console.log(`  Simulating ${task.type} with ${task.config.model || 'default model'}...`);

        // Simulate processing time based on complexity
        const complexity = task.complexity || 1;
        const processingTime = Math.random() * 5000 * complexity; // 0-5 seconds based on complexity

        await new Promise(resolve => setTimeout(resolve, processingTime));

        console.log(`  Processing completed. Output: ${task.results?.output || 'Task results available'}`);
    }

    async releaseSession(sessionId) {
        // Release compute resources
        const session = this.activeSessions.get(sessionId);

        if (!session) {
            throw new Error('Session not found');
        }

        try {
            const finalSession = await this.marketplace.releaseResource(sessionId);
            const billingSummary = await this.billing.finalizeSession(sessionId);

            this.activeSessions.delete(sessionId);

            console.log(`✓ Session ${sessionId} completed:`);
            console.log(`  Duration: ${billingSummary.duration.toFixed(2)} hours`);
            console.log(`  Cost: $${billingSummary.actualCost.toFixed(2)}`);
            console.log(`  Savings vs cloud: $${billingSummary.savings.toFixed(2)}`);

            return billingSummary;
        } catch (error) {
            console.error(`✗ Session release failed: ${error.message}`);
            throw error;
        }
    }

    async monitorProgress(sessionId) {
        // Monitor active session progress
        const session = this.activeSessions.get(sessionId);

        if (!session) {
            throw new Error('Session not found');
        }

        // Simulate progress monitoring
        const progressInterval = setInterval(async () => {
            const progress = Math.random() * 100;
            console.log(`Session ${sessionId} progress: ${progress.toFixed(1)}%`);

            if (progress >= 100) {
                clearInterval(progressInterval);
                console.log(`Session ${sessionId} completed`);
            }
        }, 2000);

        return new Promise((resolve) => {
            setTimeout(() => {
                clearInterval(progressInterval);
                resolve();
            }, 10000); // Monitor for 10 seconds
        });
    }

    async estimateCost(request) {
        // Estimate cost before allocation
        const resources = await this.searchComputeResources(request);

        if (resources.length === 0) {
            return { available: false, reason: 'No resources available' };
        }

        const bestOption = resources[0];
        const estimatedCost = bestOption.pricePerHour * request.duration * request.gpuCount;

        return {
            available: true,
            provider: bestOption.providerId,
            gpuCount: bestOption.gpuCount,
            hourlyRate: bestOption.pricePerHour,
            estimatedCost,
            location: bestOption.location,
            latency: bestOption.latency
        };
    }

    getActiveSessions() {
        return Array.from(this.activeSessions.values());
    }

    async optimizeUsage() {
        // Optimize current usage based on patterns
        const sessions = this.getActiveSessions();

        for (const session of sessions) {
            // Check if session can be downsized or extended
            const usage = session.usage || {};
            const utilization = usage.utilization || 0;

            if (utilization < 30) {
                console.log(`Session ${session.sessionId} low utilization (${utilization}%) - consider reducing resources`);
            } else if (utilization > 90) {
                console.log(`Session ${session.sessionId} high utilization (${utilization}%) - consider requesting more resources`);
            }
        }
    }

    async generateUsageReport() {
        // Generate usage and cost report
        const activeSessions = this.getActiveSessions();
        const marketStats = this.marketplace.getSessionStats();

        const report = {
            activeSessions: activeSessions.length,
            totalGPUs: activeSessions.reduce((sum, s) => sum + s.gpuCount, 0),
            totalCost: activeSessions.reduce((sum, s) => sum + s.actualCost, 0),
            averageUtilization: marketStats.averageUtilization,
            marketplaceStats: marketStats,
            sessions: activeSessions.map(s => ({
                sessionId: s.sessionId,
                provider: s.providerId,
                gpuCount: s.gpuCount,
                duration: s.estimatedDuration,
                cost: s.actualCost,
                startTime: s.startTime
            }))
        };

        console.log('=== Usage Report ===');
        console.log(`Active Sessions: ${report.activeSessions}`);
        console.log(`Total GPUs: ${report.totalGPUs}`);
        console.log(`Total Cost: $${report.totalCost.toFixed(2)}`);
        console.log(`Average Utilization: ${report.averageUtilization.toFixed(1)}%`);

        return report;
    }
}

// Example usage
if (require.main === module) {
    const config = {
        userPreferences: {
            userId: 'researcher-123',
            trustLevel: 0.8,
            priorityLatency: 0.4
        },
        billing: {
            provider: 'stripe'
        }
    };

    const client = new ComputeClient(config);

    async function demo() {
        try {
            console.log('=== GPU Rental Demo ===\n');

            // Search for available resources
            console.log('1. Searching for GPU resources...');
            const resources = await client.searchComputeResources({
                gpuCount: 2,
                duration: 2,
                priorityPrice: 0.6
            });

            // Request compute resources
            console.log('\n2. Requesting compute resources...');
            const session = await client.requestCompute({
                gpuCount: 2,
                duration: 2
            });

            // Execute a task
            console.log('\n3. Executing ML training task...');
            const task = {
                name: 'Model Training',
                type: 'ml_training',
                complexity: 2,
                config: {
                    model: 'transformer-base',
                    epochs: 10,
                    batchSize: 32
                }
            };

            await client.executeTask(task, session);

            // Monitor progress
            console.log('\n4. Monitoring session progress...');
            await client.monitorProgress(session.sessionId);

            // Release session
            console.log('\n5. Releasing resources...');
            const billingSummary = await client.releaseSession(session.sessionId);

            // Generate report
            console.log('\n6. Generating usage report...');
            await client.generateUsageReport();

        } catch (error) {
            console.error('Demo failed:', error.message);
        }
    }

    demo();
}

module.exports = ComputeClient;