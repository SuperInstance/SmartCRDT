const ldap = require('ldapjs');
const { EventEmitter } = require('events');

class UniversityIdentityService extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.ldapClient = null;
        this.tierCache = new Map();
        this.departmentCache = new Map();
        this.initialize();
    }

    async initialize() {
        // Initialize LDAP connection to university directory
        this.ldapClient = ldap.createClient({
            url: this.config.ldap.url,
            bindDN: this.config.ldap.bindDN,
            bindCredentials: this.config.ldap.bindCredentials
        });

        this.ldapClient.on('error', (err) => {
            console.error('LDAP connection error:', err);
        });

        // Load tier configurations
        this.loadTierConfigurations();

        // Periodically refresh cache
        setInterval(() => this.refreshCache(), this.config.cacheRefreshInterval || 300000); // 5 minutes

        console.log('University Identity Service initialized');
    }

    loadTierConfigurations() {
        this.tiers = {
            student: {
                name: 'Student',
                description: 'Current university students',
                baseRate: 1.00,
                priorityWeight: 1,
                maxHoursPerSession: 4,
                maxHoursPerWeek: 20,
                maxConcurrentJobs: 2,
                requiresInstructorApproval: true,
                allowedModels: ['basic', 'introductory'],
                departmentBilling: false,
                features: ['coursework_queue', 'basic_models', 'usage_limits']
            },
            faculty: {
                name: 'Faculty',
                description: 'Tenured and research faculty',
                baseRate: 2.00,
                priorityWeight: 3,
                maxHoursPerSession: 24,
                maxHoursPerWeek: 100,
                maxConcurrentJobs: 5,
                requiresInstructorApproval: false,
                allowedModels: ['basic', 'intermediate', 'advanced'],
                departmentBilling: true,
                features: ['priority_queue', 'all_models', 'extended_hours', 'department_billing']
            },
            research: {
                name: 'Research',
                description: 'Lab and department accounts',
                baseRate: 3.00,
                priorityWeight: 5,
                maxHoursPerSession: 72,
                maxHoursPerWeek: 500,
                maxConcurrentJobs: 10,
                requiresInstructorApproval: false,
                allowedModels: ['all'],
                departmentBilling: true,
                features: ['dedicated_time', 'specialized_hardware', 'proposal_required']
            },
            external: {
                name: 'External Partner',
                description: 'Industry and community partners',
                baseRate: 8.00,
                priorityWeight: 0,
                maxHoursPerSession: 8,
                maxHoursPerWeek: 40,
                maxConcurrentJobs: 3,
                requiresInstructorApproval: false,
                allowedModels: ['basic', 'intermediate'],
                departmentBilling: false,
                features: ['business_hours', 'access_monitoring']
            }
        };

        console.log('Loaded tier configurations:', Object.keys(this.tiers));
    }

    async authenticateUser(credentials) {
        // Authenticate user against university directory
        try {
            const result = await this.ldapBind(credentials.username, credentials.password);

            if (result) {
                const userInfo = await this.getUserInfo(credentials.username);
                const userTier = await this.determineUserTier(userInfo);

                return {
                    authenticated: true,
                    userId: userInfo.uid,
                    username: userInfo.uid,
                    fullName: userInfo.cn,
                    email: userInfo.mail,
                    department: userInfo.ou,
                    tier: userTier,
                    roles: userInfo.eduPersonAffiliation || [],
                    permissions: this.calculatePermissions(userTier, userInfo)
                };
            }

            return { authenticated: false };
        } catch (error) {
            console.error('Authentication error:', error);
            return { authenticated: false, error: error.message };
        }
    }

    async ldapBind(username, password) {
        return new Promise((resolve, reject) => {
            this.ldapClient.bind(
                `uid=${username},${this.config.ldap.userBaseDN}`,
                password,
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }

    async getUserInfo(username) {
        // Cache user information to reduce LDAP queries
        const cacheKey = `user_${username}`;
        const cached = this.tierCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
            return cached.data;
        }

        try {
            const searchResult = await this.ldapSearch(username);
            const userInfo = this.parseUserInfo(searchResult);

            // Update cache
            this.tierCache.set(cacheKey, {
                data: userInfo,
                timestamp: Date.now()
            });

            return userInfo;
        } catch (error) {
            console.error('Error getting user info:', error);
            throw error;
        }
    }

    async ldapSearch(username) {
        return new Promise((resolve, reject) => {
            const opts = {
                scope: 'sub',
                filter: `(uid=${username})`,
                attributes: ['uid', 'cn', 'mail', 'ou', 'eduPersonAffiliation', 'eduPersonPrimaryAffiliation']
            };

            this.ldapClient.search(this.config.ldap.userBaseDN, opts, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }

                let results = [];
                res.on('searchEntry', (entry) => {
                    results.push(entry.object);
                });

                res.on('end', () => {
                    resolve(results);
                });
            });
        });
    }

    parseUserInfo(searchResult) {
        if (searchResult.length === 0) {
            throw new Error('User not found');
        }

        const user = searchResult[0];
        return {
            uid: user.uid[0],
            cn: user.cn[0],
            mail: user.mail ? user.mail[0] : '',
            ou: user.ou ? user.ou[0] : '',
            eduPersonAffiliation: user.eduPersonAffiliation || [],
            eduPersonPrimaryAffiliation: user.eduPersonPrimaryAffiliation ? user.eduPersonPrimaryAffiliation[0] : ''
        };
    }

    async determineUserTier(userInfo) {
        // Determine user tier based on directory attributes
        const affiliations = userInfo.eduPersonAffiliation || [];
        const primaryAffiliation = userInfo.eduPersonPrimaryAffiliation || '';

        // Check for faculty status
        if (affiliations.includes('faculty') || affiliations.includes('employee') || primaryAffiliation === 'faculty') {
            // Check for research group membership
            if (userInfo.ou && this.isResearchDepartment(userInfo.ou)) {
                return 'research';
            }
            return 'faculty';
        }

        // Check for student status
        if (affiliations.includes('student') || primaryAffiliation === 'student') {
            return 'student';
        }

        // Default to external for community members
        return 'external';
    }

    isResearchDepartment(department) {
        // List of departments that typically have research computing needs
        const researchDepts = [
            'computer science',
            'mathematics',
            'physics',
            'biology',
            'chemistry',
            'engineering',
            'data science'
        ];

        return researchDepts.some(dept =>
            department.toLowerCase().includes(dept)
        );
    }

    calculatePermissions(tier, userInfo) {
        const tierConfig = this.tiers[tier];
        const permissions = [];

        // Base permissions based on tier
        permissions.push('compute_access');
        permissions.push('job_submission');

        if (tierConfig.features.includes('priority_queue')) {
            permissions.push('priority_access');
        }

        if (tierConfig.features.includes('all_models')) {
            permissions.push('all_models_access');
        }

        if (tierConfig.departmentBilling) {
            permissions.push('department_billing');
        }

        // Add department-specific permissions
        if (userInfo.ou) {
            permissions.push(`department_${userInfo.ou}`);
        }

        // Add instructor permissions if applicable
        if (userInfo.eduPersonAffiliation.includes('instructor')) {
            permissions.push('course_management');
            permissions.push('student_approval');
        }

        return permissions;
    }

    async validateRequest(request, user) {
        // Validate if user can make the request based on their tier
        const tierConfig = this.tiers[user.tier];
        const errors = [];

        // Check maximum hours per session
        if (request.duration > tierConfig.maxHoursPerSession) {
            errors.push(`Maximum session duration is ${tierConfig.maxHoursPerSession} hours for ${user.tier} tier`);
        }

        // Check concurrent job limit
        const activeJobs = await this.getActiveJobsForUser(user.userId);
        if (activeJobs.length >= tierConfig.maxConcurrentJobs) {
            errors.push(`Maximum concurrent jobs (${tierConfig.maxConcurrentJobs}) exceeded`);
        }

        // Check weekly usage
        const weeklyUsage = await this.getWeeklyUsage(user.userId);
        if (weeklyUsage + request.duration > tierConfig.maxHoursPerWeek) {
            errors.push(`Weekly usage limit (${tierConfig.maxHoursPerWeek} hours) would be exceeded`);
        }

        // Check model permissions
        if (request.models && request.models.length > 0) {
            const invalidModels = request.models.filter(model =>
                !tierConfig.allowedModels.includes(model)
            );
            if (invalidModels.length > 0) {
                errors.push(`Models not allowed for ${user.tier} tier: ${invalidModels.join(', ')}`);
            }
        }

        // Check instructor approval requirement
        if (tierConfig.requiresInstructorApproval && request.courseId) {
            const approved = await this.checkInstructorApproval(user.userId, request.courseId);
            if (!approved) {
                errors.push('Instructor approval required for this course');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            tierLimits: tierConfig
        };
    }

    async getActiveJobsForUser(userId) {
        // In real implementation, this would query the job scheduler
        // For demo, return empty array
        return [];
    }

    async getWeeklyUsage(userId) {
        // In real implementation, this would query the billing system
        // For demo, return random usage
        return Math.floor(Math.random() * 10);
    }

    async checkInstructorApproval(userId, courseId) {
        // In real implementation, this would check with course management system
        return true; // Assume approved for demo
    }

    async refreshCache() {
        console.log('Refreshing user and department cache...');
        try {
            // Refresh active user sessions
            // This would typically query active directory for recent changes

            console.log('Cache refresh completed');
        } catch (error) {
            console.error('Cache refresh error:', error);
        }
    }

    async getDepartmentInfo(departmentName) {
        // Cache department information
        const cacheKey = `dept_${departmentName}`;
        const cached = this.departmentCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
            return cached.data;
        }

        // In real implementation, query department information system
        const deptInfo = {
            name: departmentName,
            code: departmentName.toUpperCase(),
            budget: this.getDepartmentBudget(departmentName),
            priority: this.getDepartmentPriority(departmentName),
            researchFocus: this.getDepartmentFocus(departmentName)
        };

        this.departmentCache.set(cacheKey, {
            data: deptInfo,
            timestamp: Date.now()
        });

        return deptInfo;
    }

    getDepartmentBudget(departmentName) {
        // Mock department budget information
        const budgets = {
            'computer science': 500000,
            'mathematics': 300000,
            'physics': 400000,
            'biology': 350000
        };
        return budgets[departmentName.toLowerCase()] || 100000;
    }

    getDepartmentPriority(departmentName) {
        // Mock department priority
        const priorities = {
            'computer science': 'high',
            'mathematics': 'medium',
            'physics': 'high',
            'biology': 'medium'
        };
        return priorities[departmentName.toLowerCase()] || 'low';
    }

    getDepartmentFocus(departmentName) {
        // Mock department research focus
        const focuses = {
            'computer science': ['AI/ML', 'Systems', 'Theory'],
            'mathematics': ['Applied Math', 'Statistics'],
            'physics': ['Computational Physics', 'Quantum Computing'],
            'biology': ['Bioinformatics', 'Computational Biology']
        };
        return focuses[departmentName.toLowerCase()] || ['General'];
    }

    shutdown() {
        if (this.ldapClient) {
            this.ldapClient.unbind();
        }
        console.log('University Identity Service shutdown');
    }
}

// Example usage
if (require.main === module) {
    const config = {
        ldap: {
            url: 'ldap://directory.university.edu',
            bindDN: 'cn=admin,dc=university,dc=edu',
            bindCredentials: process.env.LDAP_PASSWORD,
            userBaseDN: 'ou=people,dc=university,dc=edu'
        },
        cacheTTL: 300000, // 5 minutes
        cacheRefreshInterval: 300000 // 5 minutes
    };

    const identityService = new UniversityIdentityService(config);

    async function demo() {
        try {
            console.log('=== University Identity Service Demo ===\n');

            // Test authentication (using demo credentials)
            console.log('1. Testing authentication...');
            const studentAuth = await identityService.authenticateUser({
                username: 'student123',
                password: 'password123'
            });

            console.log(`Student authenticated: ${studentAuth.authenticated}`);
            if (studentAuth.authenticated) {
                console.log(`Tier: ${studentAuth.tier}`);
                console.log(`Department: ${studentAuth.department}`);
                console.log(`Permissions: ${studentAuth.permissions.join(', ')}`);
            }

            // Test faculty authentication
            console.log('\n2. Testing faculty authentication...');
            const facultyAuth = await identityService.authenticateUser({
                username: 'faculty456',
                password: 'password456'
            });

            console.log(`Faculty authenticated: ${facultyAuth.authenticated}`);
            if (facultyAuth.authenticated) {
                console.log(`Tier: ${facultyAuth.tier}`);
                console.log(`Department: ${facultyAuth.department}`);
            }

            // Test request validation
            if (studentAuth.authenticated) {
                console.log('\n3. Testing request validation...');
                const validation = await identityService.validateRequest({
                    duration: 2,
                    models: ['basic'],
                    courseId: 'CS101'
                }, studentAuth);

                console.log(`Request valid: ${validation.valid}`);
                if (!validation.valid) {
                    console.log('Errors:', validation.errors);
                }
            }

        } catch (error) {
            console.error('Demo failed:', error.message);
        } finally {
            identityService.shutdown();
        }
    }

    demo();
}

module.exports = UniversityIdentityService;