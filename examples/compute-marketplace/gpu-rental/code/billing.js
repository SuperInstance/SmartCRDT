class Billing {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.transactions = [];
        this.pricingRules = config.pricingRules || this.getDefaultPricingRules();
    }

    getDefaultPricingRules() {
        return {
            baseRate: 5.00, // per GPU per hour
            currency: 'USD',
            billingInterval: 'hourly',
            minimumSession: 0.5, // minimum charge for 30 minutes
            discountRules: {
                longTerm: { threshold: 24, discount: 0.1 }, // 10% discount for >24 hours
                highVolume: { threshold: 4, discount: 0.15 }, // 15% discount for >4 GPUs
                recurring: { discount: 0.05 } // 5% recurring user discount
            },
            taxes: 0.08, // 8% tax
            paymentMethods: ['stripe', 'paypal', 'invoice']
        };
    }

    async startSession(sessionData) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId: sessionData.userId,
            providerId: sessionData.providerId,
            gpuCount: sessionData.gpuCount,
            startTime: new Date(),
            estimatedDuration: sessionData.duration || 1,
            status: 'active',
            hourlyRate: this.calculateHourlyRate(sessionData),
            estimatedCost: 0,
            actualCost: 0,
            transactions: []
        };

        session.estimatedCost = this.calculateEstimatedCost(session);

        this.sessions.set(sessionId, session);

        // Create initial transaction record
        await this.recordTransaction(sessionId, 'session_start', session.estimatedCost);

        return session;
    }

    calculateHourlyRate(sessionData) {
        let rate = this.pricingRules.baseRate;

        // Apply location-based adjustments
        if (sessionData.location === 'local') {
            rate *= 0.7; // 30% discount for local resources
        } else if (sessionData.location === 'campus') {
            rate *= 0.85; // 15% discount for campus resources
        }

        return rate;
    }

    calculateEstimatedCost(session) {
        let cost = session.hourlyRate * session.gpuCount * session.estimatedDuration;

        // Apply minimum session charge
        if (cost < this.pricingRules.minimumSession) {
            cost = this.pricingRules.minimumSession;
        }

        // Apply discounts
        cost = this.applyDiscounts(session, cost);

        // Add tax
        cost *= (1 + this.pricingRules.taxes);

        return cost;
    }

    applyDiscounts(session, cost) {
        let discountedCost = cost;

        // Long-term discount
        if (session.estimatedDuration >= this.pricingRules.discountRules.longTerm.threshold) {
            discountedCost *= (1 - this.pricingRules.discountRules.longTerm.discount);
        }

        // High-volume discount
        if (session.gpuCount >= this.pricingRules.discountRules.highVolume.threshold) {
            discountedCost *= (1 - this.pricingRules.discountRules.highVolume.discount);
        }

        return discountedCost;
    }

    async updateSessionUsage(sessionId, usageData) {
        const session = this.sessions.get(sessionId);

        if (!session || session.status !== 'active') {
            throw new Error('Invalid session');
        }

        // Update usage metrics
        session.usage = {
            ...session.usage,
            ...usageData,
            lastUpdated: new Date()
        };

        // Recalculate cost if duration changes
        if (usageData.duration) {
            session.actualCost = this.calculateActualCost(session);

            // Update transaction if cost changes significantly
            if (Math.abs(session.actualCost - session.estimatedCost) > session.estimatedCost * 0.1) {
                await this.recordTransaction(sessionId, 'adjustment', session.actualCost - session.estimatedCost);
            }
        }
    }

    async finalizeSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error('Session not found');
        }

        session.endTime = new Date();
        session.status = 'completed';

        // Calculate final cost
        session.actualCost = this.calculateActualCost(session);

        // Record final transaction
        await this.recordTransaction(sessionId, 'session_end', session.actualCost);

        // Process payment
        await this.processPayment(session);

        this.sessions.delete(sessionId);
        this.transactions.push(session);

        return {
            sessionId,
            userId: session.userId,
            gpuCount: session.gpuCount,
            duration: this.calculateDuration(session),
            estimatedCost: session.estimatedCost,
            actualCost: session.actualCost,
            savings: session.estimatedCost - session.actualCost
        };
    }

    calculateActualCost(session) {
        if (!session.endTime) {
            // Session still active, use current time
            session.endTime = new Date();
        }

        const durationHours = this.calculateDuration(session);
        let cost = session.hourlyRate * session.gpuCount * durationHours;

        // Apply minimum session charge
        if (cost < this.pricingRules.minimumSession) {
            cost = this.pricingRules.minimumSession;
        }

        // Apply discounts (only the ones that apply to actual usage)
        cost = this.applyDiscounts(session, cost);

        // Add tax
        cost *= (1 + this.pricingRules.taxes);

        return cost;
    }

    calculateDuration(session) {
        const endTime = session.endTime || new Date();
        const durationMs = endTime - session.startTime;
        return Math.max(durationMs / (1000 * 60 * 60), this.pricingRules.minimumSession);
    }

    async recordTransaction(sessionId, type, amount) {
        const transaction = {
            sessionId,
            type,
            amount,
            timestamp: new Date(),
            currency: this.pricingRules.currency
        };

        // In a real implementation, this would save to a database
        // and integrate with payment gateway
        console.log(`Transaction recorded: ${type} - ${amount.toFixed(2)} ${this.pricingRules.currency}`);

        return transaction;
    }

    async processPayment(session) {
        const paymentData = {
            sessionId: session.id,
            amount: session.actualCost,
            currency: this.pricingRules.currency,
            paymentMethod: session.paymentMethod || this.pricingRules.paymentMethods[0],
            userId: session.userId
        };

        // In a real implementation, this would call payment gateway API
        console.log(`Processing payment: ${session.actualCost.toFixed(2)} ${this.pricingRules.currency} for user ${session.userId}`);

        // Simulate payment processing
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Payment processed successfully');
                resolve({ success: true, transactionId: this.generateTransactionId() });
            }, 1000);
        });
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateTransactionId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getBillingReport(options = {}) {
        const { userId, startDate, endDate, status } = options;
        let report = [];

        const sessions = this.transactions.filter(session => {
            if (userId && session.userId !== userId) return false;
            if (status && session.status !== status) return false;

            const sessionDate = session.startTime;
            if (startDate && sessionDate < startDate) return false;
            if (endDate && sessionDate > endDate) return false;

            return true;
        });

        // Generate billing summary
        const summary = {
            totalSessions: sessions.length,
            totalRevenue: sessions.reduce((sum, s) => sum + s.actualCost, 0),
            averageSessionCost: sessions.length > 0 ?
                sessions.reduce((sum, s) => sum + s.actualCost, 0) / sessions.length : 0,
            totalSavings: sessions.reduce((sum, s) => sum + (s.estimatedCost - s.actualCost), 0),
            dateRange: { startDate, endDate }
        };

        return { summary, sessions };
    }

    async generateInvoice(sessionId) {
        const session = this.transactions.find(s => s.id === sessionId);

        if (!session) {
            throw new Error('Session not found');
        }

        const invoice = {
            invoiceId: this.generateInvoiceId(),
            sessionId: session.id,
            userId: session.userId,
            items: [{
                description: `${session.gpuCount} GPU hours`,
                quantity: session.duration,
                rate: session.hourlyRate,
                amount: session.actualCost
            }],
            subtotal: session.actualCost / (1 + this.pricingRules.taxes),
            tax: session.actualCost - (session.actualCost / (1 + this.pricingRules.taxes)),
            total: session.actualCost,
            currency: this.pricingRules.currency,
            issuedDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };

        console.log(`Invoice generated: ${invoice.invoiceId} for ${invoice.total.toFixed(2)} ${invoice.currency}`);
        return invoice;
    }

    generateInvoiceId() {
        return `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
}

module.exports = Billing;