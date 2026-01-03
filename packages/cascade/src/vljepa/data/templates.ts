/**
 * Template System for Synthetic Query Generation
 *
 * Provides template-based generation of labeled query-intent pairs
 * for training intent classification models.
 *
 * @package vljepa/data
 */

// Local IntentCategory enum to avoid module resolution issues
// TODO: Use @lsi/protocol import when package is properly set up
enum IntentCategory {
  QUERY = "query",
  COMMAND = "command",
  CONVERSATION = "conversation",
  CODE_GENERATION = "code_generation",
  ANALYSIS = "analysis",
  CREATIVE = "creative",
  DEBUGGING = "debugging",
  SYSTEM = "system",
  UNKNOWN = "unknown",
}

/**
 * Query template with slots for variation
 */
export interface QueryTemplate {
  /** Template string with {slot} placeholders */
  template: string;
  /** Intent category */
  intent: IntentCategory;
  /** Slot values to fill templates */
  slots: Record<string, string[]>;
  /** Difficulty level */
  difficulty: "beginner" | "intermediate" | "advanced";
}

// ============================================================================
// QUERY TEMPLATES (50+ templates)
// ============================================================================

export const QUERY_TEMPLATES: QueryTemplate[] = [
  // Beginner templates
  {
    template: "What is {concept}?",
    intent: IntentCategory.QUERY,
    slots: {
      concept: [
        "React",
        "TypeScript",
        "CRDT",
        "API",
        "database",
        "Docker",
        "Kubernetes",
        "GraphQL",
        "REST",
        "microservices",
        "CI/CD",
        "Git",
        "Linux",
        "Node.js",
        "Python",
        "machine learning",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Explain {concept} in simple terms",
    intent: IntentCategory.QUERY,
    slots: {
      concept: [
        "cryptography",
        "blockchain",
        "neural networks",
        "containers",
        "orchestration",
        "distributed systems",
        "caching",
        "load balancing",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What does {term} mean?",
    intent: IntentCategory.QUERY,
    slots: {
      term: [
        "latency",
        "throughput",
        "horizontal scaling",
        "vertical scaling",
        "ACID",
        "BASE",
        "CAP theorem",
        "eventual consistency",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "How does {technology} work?",
    intent: IntentCategory.QUERY,
    slots: {
      technology: [
        "OAuth",
        "JWT",
        "WebSockets",
        "HTTP/2",
        "gRPC",
        "Redis",
        "PostgreSQL",
        "MongoDB",
        "Elasticsearch",
        "Kafka",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Tell me about {topic}",
    intent: IntentCategory.QUERY,
    slots: {
      topic: [
        "agile methodology",
        "test-driven development",
        "code review",
        "continuous integration",
        "continuous deployment",
        "DevOps",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What are the benefits of {concept}?",
    intent: IntentCategory.QUERY,
    slots: {
      concept: [
        "serverless architecture",
        "containerization",
        "microservices",
        "monolithic architecture",
        "REST APIs",
        "GraphQL APIs",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Why use {tool}?",
    intent: IntentCategory.QUERY,
    slots: {
      tool: [
        "TypeScript instead of JavaScript",
        "PostgreSQL instead of MongoDB",
        "Docker",
        "Kubernetes",
        "Redux",
        "GraphQL",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What is the difference between {A} and {B}?",
    intent: IntentCategory.QUERY,
    slots: {
      A: ["SQL and NoSQL", "REST and GraphQL", "Git and SVN", "TCP and UDP"],
      B: ["monolith and microservices", "Docker and VM", "process and thread"],
    },
    difficulty: "beginner",
  },
  {
    template: "When should I use {technology}?",
    intent: IntentCategory.QUERY,
    slots: {
      technology: [
        "NoSQL databases",
        "message queues",
        "caching",
        "CDN",
        "load balancer",
        "API gateway",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What are the main features of {product}?",
    intent: IntentCategory.QUERY,
    slots: {
      product: [
        "React",
        "Vue",
        "Angular",
        "Svelte",
        "Next.js",
        "Nuxt.js",
        "Express",
        "Fastify",
        "NestJS",
        "Django",
        "Flask",
      ],
    },
    difficulty: "beginner",
  },

  // Intermediate templates
  {
    template: "How do I {action} with {tool}?",
    intent: IntentCategory.QUERY,
    slots: {
      action: [
        "implement authentication",
        "handle errors",
        "optimize performance",
        "set up CI/CD",
        "deploy to production",
        "configure caching",
      ],
      tool: [
        "Express",
        "React",
        "Vue",
        "Node.js",
        "Django",
        "Rails",
        "Spring Boot",
        "Laravel",
        "FastAPI",
        "NestJS",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What is the best way to {task}?",
    intent: IntentCategory.QUERY,
    slots: {
      task: [
        "structure a large React application",
        "organize a Node.js project",
        "handle state in Vue",
        "manage database migrations",
        "implement real-time features",
        "secure an API",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How can I {goal} in {language}?",
    intent: IntentCategory.QUERY,
    slots: {
      goal: [
        "improve performance",
        "reduce memory usage",
        "handle async operations",
        "manage dependencies",
        "write cleaner code",
        "debug issues",
      ],
      language: ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java"],
    },
    difficulty: "intermediate",
  },
  {
    template: "What design pattern should I use for {scenario}?",
    intent: IntentCategory.QUERY,
    slots: {
      scenario: [
        "managing application state",
        "handling API requests",
        "implementing authentication",
        "building reusable components",
        "organizing business logic",
        "handling database connections",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How do I troubleshoot {issue}?",
    intent: IntentCategory.QUERY,
    slots: {
      issue: [
        "memory leaks in Node.js",
        "slow database queries",
        "high CPU usage",
        "network timeout errors",
        "race conditions",
        "deadlocks",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What are the trade-offs between {optionA} and {optionB}?",
    intent: IntentCategory.QUERY,
    slots: {
      optionA: [
        "SQL and NoSQL",
        "monolith and microservices",
        "REST and GraphQL",
      ],
      optionB: [
        "waterfall and agile",
        "static and dynamic typing",
        "SQL and NoSQL",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How does {concept} compare to {alternative}?",
    intent: IntentCategory.QUERY,
    slots: {
      concept: ["Docker", "Kubernetes", "Redux", "MongoDB", "GraphQL"],
      alternative: ["VMs", "Docker Swarm", "MobX", "PostgreSQL", "REST"],
    },
    difficulty: "intermediate",
  },
  {
    template: "What are common pitfalls when working with {technology}?",
    intent: IntentCategory.QUERY,
    slots: {
      technology: [
        "async/await in JavaScript",
        "React hooks",
        "Python decorators",
        "Go channels",
        "Rust ownership",
        "TypeScript generics",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How do I scale {system}?",
    intent: IntentCategory.QUERY,
    slots: {
      system: [
        "a REST API",
        "a database",
        "a web application",
        "microservices",
        "a message queue",
        "a caching layer",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What metrics should I track for {domain}?",
    intent: IntentCategory.QUERY,
    slots: {
      domain: [
        "API performance",
        "database health",
        "application monitoring",
        "user engagement",
        "system reliability",
        "resource utilization",
      ],
    },
    difficulty: "intermediate",
  },

  // Advanced templates
  {
    template: "How do I implement {pattern} in {context}?",
    intent: IntentCategory.QUERY,
    slots: {
      pattern: [
        "event sourcing",
        "CQRS",
        "saga pattern",
        "circuit breaker",
        "bulkhead pattern",
        "sidecar pattern",
      ],
      context: [
        "a microservices architecture",
        "a distributed system",
        "a serverless application",
        "a real-time system",
      ],
    },
    difficulty: "advanced",
  },
  {
    template:
      "What is the complexity of {algorithm} and how can I optimize it?",
    intent: IntentCategory.QUERY,
    slots: {
      algorithm: [
        "binary search",
        "quicksort",
        "mergesort",
        "Dijkstra's algorithm",
        "A* search",
        "BFS",
        "DFS",
        "dynamic programming",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "How do I handle {challenge} in {environment}?",
    intent: IntentCategory.QUERY,
    slots: {
      challenge: [
        "distributed transactions",
        "eventual consistency",
        "network partitions",
        "data replication",
        "leader election",
        "distributed locking",
      ],
      environment: [
        "a distributed system",
        "a cloud environment",
        "a multi-region deployment",
        "a high-availability system",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What are the theoretical limits of {concept}?",
    intent: IntentCategory.QUERY,
    slots: {
      concept: [
        "horizontal scaling",
        "vertical scaling",
        "caching strategies",
        "load balancing algorithms",
        "consensus protocols",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "How do I {optimize} for {constraint}?",
    intent: IntentCategory.QUERY,
    slots: {
      optimize: [
        "optimize database queries",
        "reduce API latency",
        "improve throughput",
        "minimize memory usage",
        "maximize cache hit rate",
      ],
      constraint: [
        "high concurrency",
        "low latency requirements",
        "limited resources",
        "strict consistency requirements",
        "high availability",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What research has been done on {topic}?",
    intent: IntentCategory.QUERY,
    slots: {
      topic: [
        "distributed consensus algorithms",
        "neural network architectures",
        "database indexing strategies",
        "load balancing algorithms",
        "CAP theorem implications",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "How can I apply {theory} to {practice}?",
    intent: IntentCategory.QUERY,
    slots: {
      theory: [
        "information theory",
        "graph theory",
        "queueing theory",
        "game theory",
        "control theory",
      ],
      practice: [
        "system design",
        "network optimization",
        "resource allocation",
        "load balancing",
        "caching strategies",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What are the mathematical foundations of {concept}?",
    intent: IntentCategory.QUERY,
    slots: {
      concept: [
        "machine learning",
        "cryptography",
        "compression algorithms",
        "error correction codes",
        "hash functions",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "How do I reason about {problem} formally?",
    intent: IntentCategory.QUERY,
    slots: {
      problem: [
        "concurrent systems",
        "distributed protocols",
        "database consistency",
        "network protocols",
        "algorithm correctness",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What is the state of the art in {field}?",
    intent: IntentCategory.QUERY,
    slots: {
      field: [
        "neural architecture search",
        "automated theorem proving",
        "formal verification",
        "distributed databases",
        "serverless computing",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "How do I {action} while maintaining {quality}?",
    intent: IntentCategory.QUERY,
    slots: {
      action: [
        "scale a system",
        "reduce latency",
        "increase throughput",
        "optimize storage",
        "improve reliability",
      ],
      quality: ["consistency", "availability", "security", "performance"],
    },
    difficulty: "advanced",
  },
];

// ============================================================================
// COMMAND TEMPLATES (50+ templates)
// ============================================================================

export const COMMAND_TEMPLATES: QueryTemplate[] = [
  // Beginner templates
  {
    template: "{action} a new {resource}",
    intent: IntentCategory.COMMAND,
    slots: {
      action: ["Create", "Make", "Build", "Generate", "Write"],
      resource: [
        "React component",
        "API endpoint",
        "database table",
        "test file",
        "documentation",
        "configuration file",
        "Dockerfile",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "{action} the {problem} in my {code}",
    intent: IntentCategory.COMMAND,
    slots: {
      action: ["Fix", "Debug", "Resolve", "Investigate"],
      problem: ["bug", "error", "issue", "crash", "memory leak"],
      code: [
        "authentication code",
        "database query",
        "API call",
        "UI component",
        "configuration",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Show me how to {task}",
    intent: IntentCategory.COMMAND,
    slots: {
      task: [
        "install Node.js",
        "set up Git",
        "create a React app",
        "deploy to Heroku",
        "run tests",
        "build the project",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Give me a code example for {concept}",
    intent: IntentCategory.COMMAND,
    slots: {
      concept: [
        "implementing a REST API",
        "connecting to a database",
        "handling errors",
        "authentication",
        "file upload",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Write {content}",
    intent: IntentCategory.COMMAND,
    slots: {
      content: [
        "a function to sort an array",
        "a basic Express server",
        "a React counter component",
        "a SQL query",
        "a Python script to read a file",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Help me {task}",
    intent: IntentCategory.COMMAND,
    slots: {
      task: [
        "understand this error",
        "choose a database",
        "set up my environment",
        "write a test",
        "optimize my code",
        "debug this issue",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Teach me {concept}",
    intent: IntentCategory.COMMAND,
    slots: {
      concept: [
        "how to use Git",
        "React basics",
        "Python fundamentals",
        "SQL basics",
        "Docker fundamentals",
        "API design",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Configure {system} for {purpose}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "Webpack",
        "Babel",
        "ESLint",
        "Prettier",
        "Jest",
        "PostgreSQL",
        "Nginx",
        "Docker Compose",
      ],
      purpose: [
        "production",
        "development",
        "testing",
        "performance",
        "security",
        "monitoring",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Set up {infrastructure}",
    intent: IntentCategory.COMMAND,
    slots: {
      infrastructure: [
        "a development environment",
        "CI/CD pipeline",
        "database backup",
        "monitoring",
        "logging",
        "alerting",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Generate {artifact}",
    intent: IntentCategory.COMMAND,
    slots: {
      artifact: [
        "API documentation",
        "unit tests",
        "mock data",
        "schema",
        "migration scripts",
        "seed data",
      ],
    },
    difficulty: "beginner",
  },

  // Intermediate templates
  {
    template: "{action} the {component} to {goal}",
    intent: IntentCategory.COMMAND,
    slots: {
      action: ["Refactor", "Optimize", "Redesign", "Restructure"],
      component: [
        "codebase",
        "API",
        "database schema",
        "UI components",
        "authentication system",
        "data pipeline",
      ],
      goal: [
        "improve performance",
        "reduce complexity",
        "enhance maintainability",
        "increase scalability",
        "better security",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Implement {feature} using {technology}",
    intent: IntentCategory.COMMAND,
    slots: {
      feature: [
        "real-time updates",
        "file uploads",
        "search functionality",
        "user authentication",
        "notifications",
        "caching",
      ],
      technology: [
        "WebSockets",
        "Server-Sent Events",
        "GraphQL subscriptions",
        "Redis",
        "Memcached",
        "PostgreSQL triggers",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Debug the {issue} in {context}",
    intent: IntentCategory.COMMAND,
    slots: {
      issue: [
        "performance problem",
        "memory leak",
        "race condition",
        "deadlock",
        "concurrency issue",
      ],
      context: [
        "production environment",
        "distributed system",
        "microservices",
        "async code",
        "database queries",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Migrate {system} from {source} to {target}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "the application",
        "database",
        "authentication system",
        "API",
        "infrastructure",
      ],
      source: ["monolith", "REST", "SQL", "on-premise"],
      target: ["microservices", "GraphQL", "NoSQL", "cloud"],
    },
    difficulty: "intermediate",
  },
  {
    template: "Set up {system} with {constraints}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "database replication",
        "load balancing",
        "caching layer",
        "CDN",
        "message queue",
      ],
      constraints: [
        "high availability",
        "disaster recovery",
        "low latency",
        "automatic failover",
        "data consistency",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Create a {pattern} for {purpose}",
    intent: IntentCategory.COMMAND,
    slots: {
      pattern: [
        "design pattern",
        "architecture pattern",
        "data structure",
        "algorithm",
        "protocol",
      ],
      purpose: [
        "handling errors",
        "managing state",
        "processing events",
        "synchronizing data",
        "authenticating users",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Optimize {target} for {metric}",
    intent: IntentCategory.COMMAND,
    slots: {
      target: [
        "database queries",
        "API responses",
        "frontend rendering",
        "memory usage",
        "CPU utilization",
      ],
      metric: [
        "throughput",
        "latency",
        "resource usage",
        "cost",
        "user experience",
        "scalability",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Implement {mechanism} to ensure {property}",
    intent: IntentCategory.COMMAND,
    slots: {
      mechanism: [
        "retry logic",
        "circuit breaker",
        "rate limiting",
        "throttling",
        "bulkhead pattern",
      ],
      property: [
        "resilience",
        "stability",
        "fairness",
        "security",
        "reliability",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Design {architecture} for {requirements}",
    intent: IntentCategory.COMMAND,
    slots: {
      architecture: [
        "system architecture",
        "data architecture",
        "network architecture",
        "security architecture",
      ],
      requirements: [
        "high availability",
        "scalability",
        "fault tolerance",
        "low latency",
        "high throughput",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Write {content} that handles {edge_case}",
    intent: IntentCategory.COMMAND,
    slots: {
      content: [
        "a function",
        "a class",
        "a module",
        "a service",
        "a middleware",
        "a handler",
      ],
      edge_case: [
        "edge cases",
        "errors gracefully",
        "concurrent access",
        "failures",
        "timeouts",
      ],
    },
    difficulty: "intermediate",
  },

  // Advanced templates
  {
    template: "Design a {system} that scales to {scale}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "distributed database",
        "message broker",
        "caching system",
        "API gateway",
        "streaming platform",
      ],
      scale: [
        "millions of users",
        "petabytes of data",
        "millions of requests per second",
        "global deployment",
        "high availability",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Implement {algorithm} with {complexity} complexity",
    intent: IntentCategory.COMMAND,
    slots: {
      algorithm: [
        "a sorting algorithm",
        "a search algorithm",
        "a graph algorithm",
        "a dynamic programming solution",
        "a greedy algorithm",
      ],
      complexity: ["O(n log n)", "O(n)", "O(1)", "optimal"],
    },
    difficulty: "advanced",
  },
  {
    template: "Build a {mechanism} for {challenge}",
    intent: IntentCategory.COMMAND,
    slots: {
      mechanism: [
        "consensus protocol",
        "distributed transaction system",
        "replication strategy",
        "sharding scheme",
      ],
      challenge: [
        "distributed consistency",
        "fault tolerance",
        "network partitions",
        "high availability",
        "eventual consistency",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Create {system} using {paradigm}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "a reactive system",
        "an event-driven system",
        "a stream processing system",
        "a batch processing system",
      ],
      paradigm: [
        "reactive programming",
        "functional programming",
        "actor model",
        "CSP",
        "dataflow programming",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Optimize {system} for {constraints}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "database performance",
        "network protocols",
        "storage systems",
        "computation algorithms",
        "memory allocation",
      ],
      constraints: [
        "CAP theorem constraints",
        "PACELC constraints",
        "resource constraints",
        "latency requirements",
        "throughput requirements",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Implement {security} for {system}",
    intent: IntentCategory.COMMAND,
    slots: {
      security: [
        "zero-knowledge proofs",
        "homomorphic encryption",
        "secure multi-party computation",
        "oblivious RAM",
      ],
      system: [
        "database queries",
        "cloud storage",
        "computation outsourcing",
        "privacy-preserving analytics",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Design {protocol} for {scenario}",
    intent: IntentCategory.COMMAND,
    slots: {
      protocol: [
        "consensus protocol",
        "replication protocol",
        "communication protocol",
        "coordination protocol",
      ],
      scenario: [
        " Byzantine fault tolerance",
        "network partitions",
        "high latency networks",
        "asynchronous systems",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Create {system} that guarantees {property}",
    intent: IntentCategory.COMMAND,
    slots: {
      system: [
        "a distributed system",
        "a database",
        "a storage system",
        "a messaging system",
      ],
      property: [
        "linearizability",
        "serializability",
        "causal consistency",
        "eventual consistency",
        "strong consistency",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Build {tool} from scratch",
    intent: IntentCategory.COMMAND,
    slots: {
      tool: [
        "a simple database",
        "a web server",
        "a load balancer",
        "a message queue",
        "a distributed cache",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Prove {property} about {system}",
    intent: IntentCategory.COMMAND,
    slots: {
      property: [
        "correctness",
        "safety",
        "liveness",
        "fairness",
        "termination",
        "deadlock freedom",
      ],
      system: [
        "consensus algorithm",
        "distributed protocol",
        "concurrent algorithm",
        "locking mechanism",
      ],
    },
    difficulty: "advanced",
  },
];

// ============================================================================
// ANALYSIS TEMPLATES (50+ templates)
// ============================================================================

export const ANALYSIS_TEMPLATES: QueryTemplate[] = [
  {
    template: "Analyze the {aspect} of my {system}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      aspect: [
        "performance",
        "security",
        "scalability",
        "architecture",
        "code quality",
      ],
      system: ["API", "database", "frontend", "backend", "microservices"],
    },
    difficulty: "intermediate",
  },
  {
    template: "Compare {optionA} and {optionB} for {useCase}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      optionA: ["PostgreSQL", "MongoDB", "React", "Vue", "REST", "GraphQL"],
      optionB: ["MySQL", "Redis", "Angular", "Svelte", "gRPC", "WebSockets"],
      useCase: [
        "real-time apps",
        "analytics",
        "e-commerce",
        "social media",
        "CRUD operations",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What are the pros and cons of {technology}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      technology: [
        "microservices",
        "serverless",
        "monolith",
        "SQL databases",
        "NoSQL databases",
        "containers",
        "Kubernetes",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Explain why {phenomenon} happens in {context}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      phenomenon: [
        "performance degradation",
        "memory leaks",
        "race conditions",
        "deadlocks",
        "network timeouts",
      ],
      context: [
        "distributed systems",
        "concurrent programming",
        "database operations",
        "API calls",
        "microservices communication",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What factors affect {metric} in {system}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      metric: [
        "performance",
        "scalability",
        "reliability",
        "security",
        "maintainability",
      ],
      system: [
        "web applications",
        "databases",
        "APIs",
        "microservices",
        "distributed systems",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How does {change} impact {aspect}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      change: [
        "caching",
        "indexing",
        "sharding",
        "replication",
        "load balancing",
        "compression",
      ],
      aspect: [
        "query performance",
        "system latency",
        "throughput",
        "data consistency",
        "availability",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What is the root cause of {problem}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      problem: [
        "slow database queries",
        "high memory usage",
        "CPU spikes",
        "network latency",
        "connection timeouts",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Evaluate the {quality} of {artifact}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      quality: [
        "code quality",
        "architecture",
        "design",
        "performance",
        "security",
        "test coverage",
      ],
      artifact: [
        "this codebase",
        "this API",
        "this database schema",
        "this system design",
        "this algorithm",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What are the {type} implications of {decision}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      type: [
        "performance",
        "security",
        "scalability",
        "maintenance",
        "operational",
      ],
      decision: [
        "using microservices",
        "adopting serverless",
        "migrating to cloud",
        "switching databases",
        "implementing caching",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Break down {concept} into {components}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "this system",
        "this architecture",
        "this algorithm",
        "this protocol",
        "this process",
      ],
      components: [
        "its components",
        "its layers",
        "its steps",
        "its modules",
        "its phases",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What patterns do you see in {data}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      data: [
        "these metrics",
        "this log data",
        "this query performance",
        "this user behavior",
        "this system usage",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How {adjective} is {system} compared to {baseline}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      adjective: [
        "efficient",
        "scalable",
        "secure",
        "maintainable",
        "reliable",
      ],
      system: [
        "this architecture",
        "this approach",
        "this solution",
        "this implementation",
      ],
      baseline: [
        "industry standards",
        "best practices",
        "alternatives",
        "requirements",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What are the {type} considerations for {system}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      type: [
        "security",
        "performance",
        "scalability",
        "reliability",
        "compliance",
      ],
      system: [
        "cloud deployment",
        "distributed systems",
        "microservices",
        "databases",
        "APIs",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Analyze the {relationship} between {A} and {B}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      relationship: [
        "relationship",
        "correlation",
        "trade-off",
        "interaction",
        "dependencies",
        "coupling",
      ],
      A: [
        "system components",
        "microservices",
        "database tables",
        "API endpoints",
        "modules",
      ],
      B: [
        "system components",
        "microservices",
        "database tables",
        "API endpoints",
        "modules",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What makes {system} {adjective}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      system: [
        "this architecture",
        "this design",
        "this algorithm",
        "this approach",
        "this solution",
      ],
      adjective: [
        "scalable",
        "performant",
        "maintainable",
        "secure",
        "reliable",
        "efficient",
      ],
    },
    difficulty: "intermediate",
  },
];

// ============================================================================
// CREATIVE TEMPLATES (50+ templates)
// ============================================================================

export const CREATIVE_TEMPLATES: QueryTemplate[] = [
  {
    template: "Create a {type} for {purpose}",
    intent: IntentCategory.CREATIVE,
    slots: {
      type: [
        "story",
        "poem",
        "article",
        "blog post",
        "tutorial",
        "documentation",
        "guide",
        "example",
      ],
      purpose: [
        "explaining microservices",
        "teaching React",
        "describing REST APIs",
        "introducing Docker",
        "covering Git basics",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Write {content} about {topic}",
    intent: IntentCategory.CREATIVE,
    slots: {
      content: [
        "an introduction",
        "a summary",
        "an overview",
        "a tutorial",
        "a guide",
      ],
      topic: [
        "TypeScript",
        "GraphQL",
        "Kubernetes",
        "machine learning",
        "blockchain",
        "serverless computing",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Generate {content}",
    intent: IntentCategory.CREATIVE,
    slots: {
      content: [
        "API documentation",
        "code examples",
        "use cases",
        "test scenarios",
        "mock data",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Brainstorm ideas for {project}",
    intent: IntentCategory.CREATIVE,
    slots: {
      project: [
        "a mobile app",
        "a web application",
        "a microservice",
        "a data pipeline",
        "a developer tool",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Design a {system} for {domain}",
    intent: IntentCategory.CREATIVE,
    slots: {
      system: [
        "REST API",
        "GraphQL API",
        "microservice",
        "database schema",
        "architecture",
      ],
      domain: [
        "e-commerce",
        "social media",
        "analytics",
        "content management",
        "project management",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Come up with a name for {thing}",
    intent: IntentCategory.CREATIVE,
    slots: {
      thing: [
        "my startup",
        "my app",
        "my API",
        "my service",
        "my variable",
        "my function",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Create a {type} that {action}",
    intent: IntentCategory.CREATIVE,
    slots: {
      type: [
        "function",
        "class",
        "module",
        "service",
        "component",
        "middleware",
        "plugin",
      ],
      action: [
        "handles errors gracefully",
        "validates input",
        "logs events",
        "caches responses",
        "authenticates users",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Write {content} that {quality}",
    intent: IntentCategory.CREATIVE,
    slots: {
      content: ["documentation", "a blog post", "a tutorial", "an article"],
      quality: [
        "is engaging",
        "is easy to understand",
        "covers advanced topics",
        "includes examples",
        "targets beginners",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Generate {data_type} for {purpose}",
    intent: IntentCategory.CREATIVE,
    slots: {
      data_type: [
        "test data",
        "mock data",
        "sample data",
        "example scenarios",
        "use cases",
      ],
      purpose: [
        "API testing",
        "database seeding",
        "performance testing",
        "demo purposes",
        "documentation",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Propose a solution for {problem}",
    intent: IntentCategory.CREATIVE,
    slots: {
      problem: [
        "handling large datasets",
        "reducing API latency",
        "improving code quality",
        "scaling a database",
        "securing an application",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Design a {artifact} for {users}",
    intent: IntentCategory.CREATIVE,
    slots: {
      artifact: [
        "user interface",
        "API",
        "workflow",
        "data model",
        "architecture",
        "system",
      ],
      users: [
        "developers",
        "end users",
        "administrators",
        "analysts",
        "managers",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Invent a {type} for {context}",
    intent: IntentCategory.CREATIVE,
    slots: {
      type: [
        "algorithm",
        "data structure",
        "design pattern",
        "protocol",
        "architecture",
      ],
      context: [
        "handling real-time data",
        "managing distributed state",
        "optimizing queries",
        "processing events",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Create an analogy for {concept}",
    intent: IntentCategory.CREATIVE,
    slots: {
      concept: [
        "distributed systems",
        "microservices",
        "containers",
        "APIs",
        "databases",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Write a {type} explaining {concept}",
    intent: IntentCategory.CREATIVE,
    slots: {
      type: ["story", "metaphor", "analogy", "parable", "example"],
      concept: [
        "complexity theory",
        "distributed consensus",
        "cryptography",
        "neural networks",
        "quantum computing",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Generate {content} combining {A} and {B}",
    intent: IntentCategory.CREATIVE,
    slots: {
      content: ["a tutorial", "an article", "a guide", "an example"],
      A: ["React", "TypeScript", "GraphQL", "Docker", "Kubernetes"],
      B: ["Node.js", "Python", "PostgreSQL", "Redis", "MongoDB"],
    },
    difficulty: "intermediate",
  },
];

// ============================================================================
// CONVERSATION TEMPLATES (30+ templates)
// ============================================================================

export const CONVERSATION_TEMPLATES: QueryTemplate[] = [
  {
    template: "Hi, can you help me with {topic}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      topic: [
        "coding",
        "debugging",
        "system design",
        "architecture",
        "database design",
        "API design",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Thanks for the help with {topic}",
    intent: IntentCategory.CONVERSATION,
    slots: {
      topic: [
        "the code review",
        "debugging",
        "the architecture",
        "the implementation",
        "the explanation",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "I'm working on {project} and need advice",
    intent: IntentCategory.CONVERSATION,
    slots: {
      project: [
        "a new feature",
        "a bug fix",
        "a refactoring",
        "a migration",
        "an optimization",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What do you think about {topic}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      topic: [
        "microservices",
        "serverless",
        "TypeScript",
        "GraphQL",
        "Kubernetes",
        "monoliths",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "I've been trying to {task} but {issue}",
    intent: IntentCategory.CONVERSATION,
    slots: {
      task: [
        "optimize this query",
        "reduce latency",
        "scale the system",
        "implement caching",
        "refactor this code",
      ],
      issue: [
        "it's not working",
        "it's slow",
        "I'm stuck",
        "I keep getting errors",
        "it's complicated",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Do you have experience with {technology}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      technology: [
        "distributed systems",
        "high-frequency trading",
        "real-time systems",
        "blockchain",
        "machine learning",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What's your opinion on {topic}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      topic: [
        "code reviews",
        "testing strategies",
        "documentation",
        "agile methodologies",
        "remote work",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Can you clarify what you mean by {concept}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      concept: [
        "eventual consistency",
        "CAP theorem",
        "horizontal scaling",
        "circuit breaker",
        "saga pattern",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "That makes sense. Now, what about {topic}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      topic: [
        "the implementation details",
        "performance considerations",
        "security implications",
        "testing strategies",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template:
      "I'm not sure I understand {concept}. Can you explain differently?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      concept: [
        "distributed transactions",
        "consensus algorithms",
        "vector clocks",
        "CRDTs",
        "gossip protocols",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Have you seen {situation} before?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      situation: [
        "this error",
        "this behavior",
        "this pattern",
        "this issue",
        "this problem",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What would you do in my situation with {problem}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      problem: [
        "scaling challenges",
        "performance issues",
        "technical debt",
        "legacy code",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Is {approach} a good idea for {context}?",
    intent: IntentCategory.CONVERSATION,
    slots: {
      approach: ["microservices", "serverless", "monolith", "SQL", "NoSQL"],
      context: ["my startup", "this project", "my team", "our use case"],
    },
    difficulty: "intermediate",
  },
  {
    template: "That's interesting! Tell me more about {topic}",
    intent: IntentCategory.CONVERSATION,
    slots: {
      topic: [
        "that approach",
        "that technology",
        "that pattern",
        "that architecture",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "I disagree with {statement}. Here's why...",
    intent: IntentCategory.CONVERSATION,
    slots: {
      statement: [
        "using microservices",
        "that design choice",
        "that architecture",
        "that approach",
      ],
    },
    difficulty: "advanced",
  },
];

// ============================================================================
// REASONING TEMPLATES (30+ templates)
// ============================================================================

export const REASONING_TEMPLATES: QueryTemplate[] = [
  {
    template: "If {condition}, then {consequence}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      condition: [
        "I add an index",
        "I implement caching",
        "I use a load balancer",
        "I shard the database",
        "I replicate data",
      ],
      consequence: [
        "will performance improve",
        "will latency decrease",
        "will throughput increase",
        "will costs go down",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Why does {phenomenon} occur?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      phenomenon: [
        "race conditions",
        "deadlocks",
        "memory leaks",
        "network partitions",
        "split-brain scenarios",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What is the logical sequence for {process}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      process: [
        "debugging distributed systems",
        "designing APIs",
        "migrating to microservices",
        "implementing CI/CD",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Given {premises}, what can we conclude?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      premises: [
        "high latency and low throughput",
        "memory leaks and CPU spikes",
        "network timeouts and retries",
        "slow queries and high load",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Is {statement} true or false? Explain.",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      statement: [
        "SQL is always better than NoSQL",
        "microservices are always superior",
        "REST is obsolete",
        "monoliths can't scale",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What assumptions underlie {approach}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      approach: [
        "the CAP theorem",
        "eventual consistency",
        "strong consistency",
        "horizontal scaling",
        "vertical scaling",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "How does {A} relate to {B}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      A: [
        "consistency",
        "availability",
        "partition tolerance",
        "latency",
        "throughput",
      ],
      B: [
        "scalability",
        "reliability",
        "performance",
        "user experience",
        "system design",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What is the logic behind {algorithm}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      algorithm: [
        "consensus algorithms",
        "leader election",
        "distributed locking",
        "vector clocks",
        "gossip protocols",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "Can you prove {claim}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      claim: [
        "this algorithm is correct",
        "this system is consistent",
        "this approach is optimal",
        "this design is sound",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What are the implications of {principle}?",
    intent: IntentCategory.CODE_GENERATION,
    slots: {
      principle: [
        "CAP theorem",
        "PACELC theorem",
        " Brewer's conjecture",
        "linearizability",
        "serializability",
      ],
    },
    difficulty: "advanced",
  },
];

// ============================================================================
// DEBUGGING TEMPLATES (30+ templates)
// ============================================================================

export const DEBUGGING_TEMPLATES: QueryTemplate[] = [
  {
    template: "I'm getting {error}. How do I fix it?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      error: [
        "a 404 error",
        "a 500 error",
        "a timeout error",
        "a connection error",
        "an authentication error",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Why is my {component} not working?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      component: [
        "API call",
        "database query",
        "authentication",
        "file upload",
        "webhook",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Debug this {code_type}",
    intent: IntentCategory.DEBUGGING,
    slots: {
      code_type: [
        "function",
        "class",
        "module",
        "service",
        "API endpoint",
        "database query",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "I'm experiencing {symptom}. What could be the cause?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      symptom: [
        "high memory usage",
        "CPU spikes",
        "slow queries",
        "intermittent failures",
        "random crashes",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How do I {action} this {issue}?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      action: ["diagnose", "troubleshoot", "fix", "resolve", "work around"],
      issue: [
        "performance issue",
        "memory leak",
        "race condition",
        "deadlock",
        "timeout",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What tools can I use to debug {problem}?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      problem: [
        "network issues",
        "memory leaks",
        "performance bottlenecks",
        "concurrency bugs",
        "distributed systems",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "My {system} is {behavior}. Help!",
    intent: IntentCategory.DEBUGGING,
    slots: {
      system: [
        "database",
        "API",
        "application",
        "service",
        "microservice",
        "queue",
      ],
      behavior: [
        "running slowly",
        "crashing",
        "hanging",
        "returning errors",
        "timing out",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "I'm seeing {pattern} in my logs. What does it mean?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      pattern: [
        "connection refused",
        "timeout errors",
        "out of memory",
        "high CPU usage",
        "disk full",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How do I investigate {issue} in {environment}?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      issue: [
        "performance degradation",
        "memory leaks",
        "connection issues",
        "scaling problems",
        "failures",
      ],
      environment: [
        "production",
        "staging",
        "development",
        "distributed systems",
        "cloud",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What's wrong with my {code_type}?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      code_type: [
        "SQL query",
        "HTTP request",
        "async code",
        "Promise chain",
        "error handling",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Why am I getting {error} when {action}?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      error: [
        "TypeError",
        "ReferenceError",
        "NetworkError",
        "AuthError",
        "ValidationError",
      ],
      action: [
        "making requests",
        "connecting to the database",
        "calling the API",
        "authenticating",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "How do I trace {problem} in {system}?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      problem: [
        "a bug",
        "an error",
        "a performance issue",
        "a race condition",
        "a deadlock",
      ],
      system: [
        "distributed systems",
        "microservices",
        "async code",
        "concurrent code",
        "production",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "My {test} is failing. How do I fix it?",
    intent: IntentCategory.DEBUGGING,
    slots: {
      test: [
        "unit test",
        "integration test",
        "e2e test",
        "performance test",
        "load test",
      ],
    },
    difficulty: "intermediate",
  },
];

// ============================================================================
// LEARNING TEMPLATES (30+ templates)
// ============================================================================

export const LEARNING_TEMPLATES: QueryTemplate[] = [
  {
    template: "Teach me {concept}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "React",
        "TypeScript",
        "GraphQL",
        "Docker",
        "Kubernetes",
        "CI/CD",
        "TDD",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "I want to learn {topic}. Where should I start?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      topic: [
        "distributed systems",
        "machine learning",
        "cloud computing",
        "DevOps",
        "microservices",
        "API design",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What are the prerequisites for {concept}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "Kubernetes",
        "machine learning",
        "distributed systems",
        "advanced algorithms",
        "system design",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "Explain {concept} like I'm {level}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "blockchain",
        "neural networks",
        "quantum computing",
        "cryptography",
        "distributed consensus",
      ],
      level: [
        "five years old",
        "a beginner",
        "an intermediate developer",
        "a non-technical person",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What resources do you recommend for learning {topic}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      topic: [
        "system design",
        "algorithms",
        "data structures",
        "distributed systems",
        "cloud architecture",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How do I advance from {current} to {target}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      current: ["beginner", "junior developer", "intermediate"],
      target: [
        "intermediate",
        "senior developer",
        "expert",
        "architect",
        "tech lead",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What should I focus on learning next in {domain}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      domain: [
        "web development",
        "backend development",
        "DevOps",
        "data engineering",
        "machine learning",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "I understand {concept}. What's next?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "basic JavaScript",
        "HTML and CSS",
        "Python basics",
        "SQL fundamentals",
        "Git basics",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "Create a learning path for {goal}",
    intent: IntentCategory.ANALYSIS,
    slots: {
      goal: [
        "becoming a full-stack developer",
        "learning cloud computing",
        "mastering system design",
        "becoming a DevOps engineer",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What are the key concepts in {field}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      field: [
        "distributed systems",
        "machine learning",
        "cloud computing",
        "cybersecurity",
        "data engineering",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How long does it take to learn {concept}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "Docker",
        "Kubernetes",
        "React",
        "system design",
        "algorithms and data structures",
      ],
    },
    difficulty: "beginner",
  },
  {
    template: "What projects should I build to learn {skill}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      skill: [
        "React",
        "Django",
        "system design",
        "API development",
        "database design",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "I'm struggling with {concept}. Help me understand.",
    intent: IntentCategory.ANALYSIS,
    slots: {
      concept: [
        "async/await",
        "recursion",
        "pointers",
        "closures",
        "promises",
        "generators",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template:
      "What's the difference between {A} and {B}? Explain for beginners.",
    intent: IntentCategory.ANALYSIS,
    slots: {
      A: ["monolith", "SQL", "synchronous", "imperative"],
      B: ["microservices", "NoSQL", "asynchronous", "functional"],
    },
    difficulty: "beginner",
  },
];

// ============================================================================
// OPTIMIZATION TEMPLATES (30+ templates)
// ============================================================================

export const OPTIMIZATION_TEMPLATES: QueryTemplate[] = [
  {
    template: "How do I optimize {target}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      target: [
        "database queries",
        "API performance",
        "frontend rendering",
        "memory usage",
        "CPU utilization",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What strategies can I use to improve {metric}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      metric: [
        "query performance",
        "response time",
        "throughput",
        "resource utilization",
        "cache hit rate",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How can I reduce {metric} in {system}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      metric: [
        "latency",
        "memory usage",
        "CPU usage",
        "cost",
        "network traffic",
      ],
      system: ["my API", "my database", "my application", "my infrastructure"],
    },
    difficulty: "intermediate",
  },
  {
    template: "What are the best practices for {optimization}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      optimization: [
        "query optimization",
        "code optimization",
        "database optimization",
        "API optimization",
        "frontend optimization",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How do I scale {system} to handle {load}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      system: ["my API", "my database", "my application", "my microservices"],
      load: ["more users", "more requests", "more data", "higher concurrency"],
    },
    difficulty: "advanced",
  },
  {
    template: "What caching strategy should I use for {use_case}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      use_case: [
        "API responses",
        "database queries",
        "session data",
        "static content",
        "computed results",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How can I improve the {quality} of my {artifact}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      quality: [
        "performance",
        "efficiency",
        "scalability",
        "maintainability",
        "reliability",
      ],
      artifact: [
        "code",
        "database schema",
        "API design",
        "architecture",
        "algorithms",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What tools can help me {task}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      task: [
        "optimize performance",
        "reduce costs",
        "improve scalability",
        "monitor resources",
        "profile code",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "I'm experiencing {issue}. How can I optimize?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      issue: [
        "slow queries",
        "high memory usage",
        "slow API responses",
        "poor throughput",
        "resource exhaustion",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "What are the trade-offs between {A} and {B} for optimization?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      A: ["horizontal scaling", "caching", "denormalization"],
      B: ["vertical scaling", "computation", "normalization"],
    },
    difficulty: "advanced",
  },
  {
    template: "How do I {action} for {constraint}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      action: [
        "optimize queries",
        "design the system",
        "allocate resources",
        "configure caching",
      ],
      constraint: [
        "low latency",
        "high throughput",
        "limited memory",
        "cost constraints",
        "high availability",
      ],
    },
    difficulty: "advanced",
  },
  {
    template: "What metrics should I monitor to track {metric}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      metric: [
        "performance",
        "efficiency",
        "scalability",
        "cost-effectiveness",
        "resource utilization",
      ],
    },
    difficulty: "intermediate",
  },
  {
    template: "How can I reduce {cost} while maintaining {quality}?",
    intent: IntentCategory.ANALYSIS,
    slots: {
      cost: ["cloud costs", "operational costs", "infrastructure costs"],
      quality: [
        "performance",
        "reliability",
        "availability",
        "user experience",
      ],
    },
    difficulty: "advanced",
  },
];

// ============================================================================
// Export all templates
// ============================================================================

export const ALL_TEMPLATES: QueryTemplate[] = [
  ...QUERY_TEMPLATES,
  ...COMMAND_TEMPLATES,
  ...ANALYSIS_TEMPLATES,
  ...CREATIVE_TEMPLATES,
  ...CONVERSATION_TEMPLATES,
  ...REASONING_TEMPLATES,
  ...DEBUGGING_TEMPLATES,
  ...LEARNING_TEMPLATES,
  ...OPTIMIZATION_TEMPLATES,
];
