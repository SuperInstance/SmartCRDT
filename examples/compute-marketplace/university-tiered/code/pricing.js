class UniversityPricingEngine {
    constructor(config) {
        this.config = config;
        this.tiers = this.initializeTiers();
        this.discounts = this.initializeDiscounts();
        this.marketRates = config.marketRates || this.getDefaultMarketRates();
    }

    initializeTiers() {
        return {
            student: {
                baseRate: 1.00,
                priorityWeight: 1,
                educationalMultiplier: 0.125, // 12.5% of market rate
                features: ['coursework_queue', 'basic_models', 'usage_limits']
            },
            faculty: {
                baseRate: 2.00,
                priorityWeight: 3,
                educationalMultiplier: 0.25, // 25% of market rate
                features: ['priority_queue', 'all_models', 'extended_hours', 'department_billing']
            },
            research: {
                baseRate: 3.00,
                priorityWeight: 5,
                educationalMultiplier: 0.375, // 37.5% of market rate
                features: ['dedicated_time', 'specialized_hardware', 'proposal_required']
            },
            external: {
                baseRate: 8.00,
                priorityWeight: 0,
                educationalMultiplier: 1.0, // 100% of market rate
                features: ['business_hours', 'access_monitoring']
            }
        };
    }

    initializeDiscounts() {
        return {
            longTerm: {
                threshold: 24, // hours
                discount: 0.10 // 10% discount
            },
            highVolume: {
                threshold: 8, // GPUs
                discount: 0.15 // 15% discount
            },
            courseDiscount: {
                multiplier: 0.8, // 20% discount for course work
                requires: ['student', 'coursework']
            },
            grantSubsidy: {
                multiplier: 0.7, // 30% subsidy for grant-funded research
                requires: ['faculty', 'grant', 'research']
            },
            startupPartner: {
                multiplier: 0.6, // 40% discount for startup partners
                requires: ['external', 'startup', 'partnership']
            }
        };
    }

    getDefaultMarketRates() {
        return {
            basic: 8.00,
            intermediate: 12.00,
            advanced: 16.00,
            specialized: 24.00
        };
    }

    calculateRate(tier, modelType, options = {}) {
        // Base rate from tier
        const tierConfig = this.tiers[tier];
        let rate = tierConfig.baseRate;

        // Apply model-specific adjustments
        const modelMultiplier = this.getModelMultiplier(modelType, tier);
        rate *= modelMultiplier;

        // Apply educational discount if applicable
        if (tierConfig.educationalMultiplier < 1) {
            const marketRate = this.marketRates[modelType] || this.marketRates.basic;
            rate = marketRate * tierConfig.educationalMultiplier;
        }

        // Apply priority surcharge for high-tier users
        if (options.priorityAccess && tierConfig.priorityWeight > 1) {
            rate *= (1 + (tierConfig.priorityWeight - 1) * 0.1);
        }

        // Apply location adjustment
        if (options.location === 'remote') {
            rate *= 1.2; // 20% premium for remote access
        } else if (options.location === 'on-prem') {
            rate *= 0.8; // 20% discount for on-prem usage
        }

        // Round to nearest cent
        return Math.round(rate * 100) / 100;
    }

    getModelMultiplier(modelType, tier) {
        const tierConfig = this.tiers[tier];
        const baseRates = this.marketRates;

        if (!baseRates[modelType]) {
            modelType = 'basic';
        }

        return baseRates[modelType] / baseRates.basic;
    }

    calculateTotalCost(request, user) {
        const tier = user.tier;
        const baseRate = this.calculateRate(tier, request.modelType, request.options);

        // Base cost calculation
        let totalCost = baseRate * request.gpuCount * request.duration;

        // Apply discounts
        totalCost = this.applyDiscounts(totalCost, request, user);

        // Apply taxes if applicable
        if (request.taxable !== false) {
            totalCost *= (1 + (request.taxRate || 0.08)); // 8% default tax
        }

        // Apply minimum charge
        totalCost = Math.max(totalCost, this.getMinimumCharge(tier));

        return Math.round(totalCost * 100) / 100;
    }

    applyDiscounts(baseCost, request, user) {
        let discountedCost = baseCost;

        // Long-term discount
        if (request.duration >= this.discounts.longTerm.threshold) {
            discountedCost *= (1 - this.discounts.longTerm.discount);
        }

        // High-volume discount
        if (request.gpuCount >= this.discounts.highVolume.threshold) {
            discountedCost *= (1 - this.discounts.highVolume.discount);
        }

        // Course discount for students
        if (this.isEligibleForDiscount(this.discounts.courseDiscount, user, request)) {
            discountedCost *= this.discounts.courseDiscount.multiplier;
        }

        // Grant subsidy for faculty research
        if (this.isEligibleForDiscount(this.discounts.grantSubsidy, user, request)) {
            discountedCost *= this.discounts.grantSubsidy.multiplier;
        }

        // Startup partner discount
        if (this.isEligibleForDiscount(this.discounts.startupPartner, user, request)) {
            discountedCost *= this.discounts.startupPartner.multiplier;
        }

        return discountedCost;
    }

    isEligibleForDiscount(discount, user, request) {
        // Check if user/request meets discount criteria
        return discount.requires.every(req => {
            if (req === user.tier) return true;
            if (req === 'coursework' && request.courseId) return true;
            if (req === 'grant' && request.grantId) return true;
            if (req === 'research' && request.purpose === 'research') return true;
            if (req === 'startup' && user.organizationType === 'startup') return true;
            if (req === 'partnership' && user.partnerTier) return true;
            return false;
        });
    }

    getMinimumCharge(tier) {
        const minimums = {
            student: 0.50,
            faculty: 1.00,
            research: 2.00,
            external: 5.00
        };
        return minimums[tier] || 1.00;
    }

    compareWithCloud(request, user) {
        const ourCost = this.calculateTotalCost(request, user);
        const cloudRate = this.marketRates[request.modelType] || this.marketRates.basic;
        const cloudCost = cloudRate * request.gpuCount * request.duration;

        const savings = cloudCost - ourCost;
        const savingsPercent = (savings / cloudCost) * 100;

        return {
            universityCost: ourCost,
            cloudCost: cloudCost,
            savings: savings,
            savingsPercent: savingsPercent,
            costComparison: {
                university: ourCost,
                cloud: cloudCost,
                ratio: ourCost / cloudCost
            }
        };
    }

    generateCostBreakdown(request, user) {
        const tier = user.tier;
        const baseRate = this.calculateRate(tier, request.modelType, request.options);

        const breakdown = {
            baseRate: baseRate,
            gpuHours: request.gpuCount * request.duration,
            baseCost: baseRate * request.gpuCount * request.duration,
            discounts: [],
            taxableAmount: 0,
            taxAmount: 0,
            totalCost: 0
        };

        // Calculate and list discounts
        let discountedCost = breakdown.baseCost;

        if (request.duration >= this.discounts.longTerm.threshold) {
            const discount = breakdown.baseCost * this.discounts.longTerm.discount;
            discountedCost -= discount;
            breakdown.discounts.push({
                type: 'long_term',
                description: `${this.discounts.longTerm.threshold}+ hour discount`,
                amount: discount
            });
        }

        if (request.gpuCount >= this.discounts.highVolume.threshold) {
            const discount = breakdown.baseCost * this.discounts.highVolume.discount;
            discountedCost -= discount;
            breakdown.discounts.push({
                type: 'high_volume',
                description: `${this.discounts.highVolume.threshold}+ GPU volume discount`,
                amount: discount
            });
        }

        // Apply other discounts
        if (this.isEligibleForDiscount(this.discounts.courseDiscount, user, request)) {
            const discount = discountedCost * (1 - this.discounts.courseDiscount.multiplier);
            discountedCost *= this.discounts.courseDiscount.multiplier;
            breakdown.discounts.push({
                type: 'course_discount',
                description: 'Educational course discount',
                amount: discount
            });
        }

        // Calculate tax
        breakdown.taxableAmount = discountedCost;
        breakdown.taxAmount = breakdown.taxableAmount * (request.taxRate || 0.08);
        breakdown.totalCost = breakdown.taxableAmount + breakdown.taxAmount;

        return breakdown;
    }

    generatePricingReport() {
        const report = {
            tiers: {},
            marketComparison: {},
            savingsAnalysis: {}
        };

        // Generate report for each tier
        Object.keys(this.tiers).forEach(tier => {
            const sampleRequests = [
                { gpuCount: 1, duration: 1, modelType: 'basic' },
                { gpuCount: 2, duration: 4, modelType: 'intermediate' },
                { gpuCount: 4, duration: 8, modelType: 'advanced' },
                { gpuCount: 8, duration: 24, modelType: 'specialized' }
            ];

            report.tiers[tier] = {
                description: this.tiers[tier].features.join(', '),
                samplePricing: sampleRequests.map(req => ({
                    ...req,
                    rate: this.calculateRate(tier, req.modelType),
                    cost: this.calculateTotalCost({
                        ...req,
                        options: {},
                        taxable: false
                    }, { tier })
                }))
            };
        });

        // Market comparison
        Object.keys(this.marketRates).forEach(modelType => {
            const universityRate = this.calculateRate('faculty', modelType);
            report.marketComparison[modelType] = {
                marketRate: this.marketRates[modelType],
                universityRate: universityRate,
                discountPercent: ((this.marketRates[modelType] - universityRate) / this.marketRates[modelType]) * 100
            };
        });

        return report;
    }

    updateMarketRates(newRates) {
        // Update market rates and recalculate
        this.marketRates = { ...this.marketRates, ...newRates };
        console.log('Market rates updated:', newRates);
    }

    getPriorityQueuePosition(user, currentQueue) {
        // Calculate position in priority queue based on tier and current queue
        const tierPriority = {
            student: 1,
            faculty: 3,
            research: 5,
            external: 0
        };

        const userPriority = tierPriority[user.tier] || 1;

        // Count users ahead in queue with higher or equal priority
        let position = 1;
        for (const queuedUser of currentQueue) {
            const queuedPriority = tierPriority[queuedUser.tier] || 1;
            if (queuedPriority >= userPriority) {
                position++;
            }
        }

        return position;
    }
}

// Example usage
if (require.main === module) {
    const config = {
        marketRates: {
            basic: 8.00,
            intermediate: 12.00,
            advanced: 16.00,
            specialized: 24.00
        }
    };

    const pricingEngine = new UniversityPricingEngine(config);

    async function demo() {
        console.log('=== University Pricing Engine Demo ===\n');

        // Test rate calculation for different tiers
        console.log('1. Tier-based rate comparison:');
        const modelType = 'intermediate';
        Object.keys(pricingEngine.tiers).forEach(tier => {
            const rate = pricingEngine.calculateRate(tier, modelType);
            console.log(`${tier.toUpperCase()}: $${rate.toFixed(2)}/hour`);
        });

        // Test cost calculation
        console.log('\n2. Cost calculation examples:');
        const request = {
            gpuCount: 2,
            duration: 4,
            modelType: 'advanced',
            options: {},
            taxable: true
        };

        ['student', 'faculty', 'research', 'external'].forEach(tier => {
            const user = { tier };
            const cost = pricingEngine.calculateTotalCost(request, user);
            const breakdown = pricingEngine.generateCostBreakdown(request, user);

            console.log(`\n${tier.toUpperCase()} tier:`);
            console.log(`  Total cost: $${cost.toFixed(2)}`);
            console.log(`  Base cost: $${breakdown.baseCost.toFixed(2)}`);
            console.log(`  Discounts: $${breakdown.discounts.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}`);
            console.log(`  Tax: $${breakdown.taxAmount.toFixed(2)}`);
        });

        // Cloud comparison
        console.log('\n3. Cloud cost comparison:');
        const cloudCompare = pricingEngine.compareWithCloud(request, { tier: 'faculty' });
        console.log(`University: $${cloudCompare.universityCost.toFixed(2)}`);
        console.log(`Cloud: $${cloudCompare.cloudCost.toFixed(2)}`);
        console.log(`Savings: $${cloudCompare.savings.toFixed(2)} (${cloudCompare.savingsPercent.toFixed(1)}%)`);

        // Pricing report
        console.log('\n4. Pricing report:');
        const report = pricingEngine.generatePricingReport();
        console.log(`Average faculty discount: ${Object.values(report.marketComparison).reduce((sum, c) => sum + c.discountPercent, 0) / Object.keys(report.marketComparison).length}%,`);
    }

    demo();
}

module.exports = UniversityPricingEngine;