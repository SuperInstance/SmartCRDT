"use strict";
/**
 * @lsi/protocol - Protocol Registry
 *
 * Central registry for all Aequor protocols with version tracking, compatibility
 * checking, dependency resolution, and migration paths.
 *
 * This module provides:
 * - Protocol registration and version tracking
 * - Compatibility matrix management
 * - Dependency resolution
 * - Migration path generation
 * - Deprecation status tracking
 *
 * Usage:
 * ```typescript
 * import { ProtocolRegistry } from '@lsi/protocol';
 *
 * const registry = new ProtocolRegistry();
 *
 * // Register a protocol
 * registry.register({
 *   id: 'atp',
 *   name: 'Autonomous Task Processing',
 *   version: { major: 1, minor: 0, patch: 0 },
 *   stability: 'stable'
 * });
 *
 * // Check compatibility
 * const compatible = registry.are_compatible('atp@1.0.0', 'atp@1.1.0');
 *
 * // Get migration path
 * const path = registry.get_migration_path(
 *   { major: 1, minor: 0, patch: 0 },
 *   { major: 2, minor: 0, patch: 0 }
 * );
 * ```
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalProtocolRegistry = exports.ProtocolRegistry = exports.DependencyGraph = void 0;
exports.parseSemVer = parseSemVer;
exports.formatSemVer = formatSemVer;
exports.compareSemVer = compareSemVer;
exports.isVersionCompatible = isVersionCompatible;
exports.satisfiesConstraint = satisfiesConstraint;
/**
 * Parse SemVer from string
 */
function parseSemVer(version) {
    var match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
    if (!match) {
        throw new Error("Invalid SemVer string: ".concat(version));
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4],
        build: match[5],
    };
}
/**
 * Format SemVer to string
 */
function formatSemVer(version) {
    var result = "".concat(version.major, ".").concat(version.minor, ".").concat(version.patch);
    if (version.prerelease) {
        result += "-".concat(version.prerelease);
    }
    if (version.build) {
        result += "+".concat(version.build);
    }
    return result;
}
/**
 * Compare two SemVer versions
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
function compareSemVer(a, b) {
    var _a, _b;
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    if (a.patch !== b.patch)
        return a.patch - b.patch;
    var aPre = (_a = a.prerelease) !== null && _a !== void 0 ? _a : "";
    var bPre = (_b = b.prerelease) !== null && _b !== void 0 ? _b : "";
    if (aPre === bPre)
        return 0;
    return aPre < bPre ? -1 : 1;
}
/**
 * Check if version a is compatible with version b
 * Compatible if major version matches and a <= b
 */
function isVersionCompatible(a, b) {
    if (a.major !== b.major)
        return false;
    var cmp = compareSemVer(a, b);
    return cmp <= 0;
}
/**
 * Check if a version satisfies a constraint
 */
function satisfiesConstraint(version, constraint) {
    if (constraint.exactVersion) {
        return compareSemVer(version, constraint.exactVersion) === 0;
    }
    if (constraint.minVersion &&
        compareSemVer(version, constraint.minVersion) < 0) {
        return false;
    }
    if (constraint.maxVersion &&
        compareSemVer(version, constraint.maxVersion) >= 0) {
        return false;
    }
    return true;
}
/**
 * Dependency graph
 */
var DependencyGraph = /** @class */ (function () {
    function DependencyGraph() {
        this.nodes = new Map();
    }
    /** Add a node to the graph */
    DependencyGraph.prototype.addNode = function (node) {
        this.nodes.set("".concat(node.protocolId, "@").concat(formatSemVer(node.version)), node);
    };
    /** Get a node from the graph */
    DependencyGraph.prototype.getNode = function (protocolId, version) {
        return this.nodes.get("".concat(protocolId, "@").concat(formatSemVer(version)));
    };
    /** Get all dependencies for a protocol (transitive) */
    DependencyGraph.prototype.getTransitiveDependencies = function (protocolId, version) {
        var visited = new Set();
        var queue = ["".concat(protocolId, "@").concat(formatSemVer(version))];
        while (queue.length > 0) {
            var key = queue.shift();
            if (visited.has(key))
                continue;
            visited.add(key);
            var node = this.nodes.get(key);
            if (node) {
                for (var _i = 0, _a = node.dependencies; _i < _a.length; _i++) {
                    var dep = _a[_i];
                    var depKey = "".concat(dep.protocolId, "@").concat(formatSemVer(dep.versionConstraint.exactVersion));
                    queue.push(depKey);
                }
            }
        }
        return visited;
    };
    /** Check for circular dependencies */
    DependencyGraph.prototype.hasCircularDependencies = function () {
        var _this = this;
        var WHITE = 0; // Not visited
        var GRAY = 1; // Visiting
        var BLACK = 2; // Visited
        var color = new Map();
        var keys = Array.from(this.nodes.keys());
        var dfs = function (key) {
            var _a;
            color.set(key, GRAY);
            var node = _this.nodes.get(key);
            if (node) {
                for (var _i = 0, _b = node.dependencies; _i < _b.length; _i++) {
                    var dep = _b[_i];
                    var depKey = "".concat(dep.protocolId, "@").concat(formatSemVer(dep.versionConstraint.exactVersion));
                    var depColor = (_a = color.get(depKey)) !== null && _a !== void 0 ? _a : WHITE;
                    if (depColor === GRAY)
                        return true; // Back edge
                    if (depColor === WHITE && dfs(depKey))
                        return true;
                }
            }
            color.set(key, BLACK);
            return false;
        };
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            if (color.get(key) === WHITE) {
                if (dfs(key))
                    return true;
            }
        }
        return false;
    };
    return DependencyGraph;
}());
exports.DependencyGraph = DependencyGraph;
// ============================================================================
// PROTOCOL REGISTRY
// ============================================================================
/**
 * Protocol registry with version tracking and compatibility management
 */
var ProtocolRegistry = /** @class */ (function () {
    function ProtocolRegistry() {
        this.protocols = new Map();
        this.compatibilityMatrix = {};
        this.dependencyGraph = new DependencyGraph();
        this.initializeBuiltInProtocols();
    }
    // ========================================================================
    // REGISTRATION
    // ========================================================================
    /**
     * Register a protocol
     */
    ProtocolRegistry.prototype.register = function (protocol) {
        var key = protocol.id;
        if (!this.protocols.has(key)) {
            this.protocols.set(key, []);
        }
        var versions = this.protocols.get(key);
        // Check for duplicate version
        var exists = versions.some(function (v) { return compareSemVer(v.version, protocol.version) === 0; });
        if (exists) {
            throw new Error("Protocol ".concat(key, "@").concat(formatSemVer(protocol.version), " already registered"));
        }
        versions.push(protocol);
        versions.sort(function (a, b) { return compareSemVer(b.version, a.version); }); // Newest first
        // Add to dependency graph
        this.dependencyGraph.addNode({
            protocolId: protocol.id,
            version: protocol.version,
            dependencies: protocol.dependencies,
            dependents: [],
        });
        // Initialize compatibility matrix if needed
        if (!this.compatibilityMatrix[key]) {
            this.compatibilityMatrix[key] = {};
        }
        var versionStr = formatSemVer(protocol.version);
        if (!this.compatibilityMatrix[key][versionStr]) {
            this.compatibilityMatrix[key][versionStr] = {};
        }
    };
    /**
     * Unregister a protocol version
     */
    ProtocolRegistry.prototype.unregister = function (protocolId, version) {
        var versions = this.protocols.get(protocolId);
        if (!versions)
            return;
        var index = versions.findIndex(function (v) { return compareSemVer(v.version, version) === 0; });
        if (index >= 0) {
            versions.splice(index, 1);
        }
        if (versions.length === 0) {
            this.protocols.delete(protocolId);
        }
    };
    /**
     * Get protocol info
     */
    ProtocolRegistry.prototype.get = function (protocolId, version) {
        var versions = this.protocols.get(protocolId);
        if (!versions)
            return undefined;
        if (version) {
            return versions.find(function (v) { return compareSemVer(v.version, version) === 0; });
        }
        // Return latest version
        return versions[0];
    };
    /**
     * List all protocols
     */
    ProtocolRegistry.prototype.list = function () {
        var result = [];
        for (var _i = 0, _a = this.protocols.values(); _i < _a.length; _i++) {
            var versions = _a[_i];
            // Return latest version of each protocol
            result.push(versions[0]);
        }
        return result;
    };
    /**
     * List all versions of a protocol
     */
    ProtocolRegistry.prototype.listVersions = function (protocolId) {
        var _a;
        return (_a = this.protocols.get(protocolId)) !== null && _a !== void 0 ? _a : [];
    };
    /**
     * List protocols by version
     */
    ProtocolRegistry.prototype.listByVersion = function (version) {
        var result = [];
        for (var _i = 0, _a = this.protocols.values(); _i < _a.length; _i++) {
            var versions = _a[_i];
            for (var _b = 0, versions_1 = versions; _b < versions_1.length; _b++) {
                var protocol = versions_1[_b];
                if (compareSemVer(protocol.version, version) === 0) {
                    result.push(protocol);
                }
            }
        }
        return result;
    };
    // ========================================================================
    // COMPATIBILITY
    // ========================================================================
    /**
     * Check if two protocol versions are compatible
     */
    ProtocolRegistry.prototype.are_compatible = function (protocol_a, protocol_b) {
        var _a = this.parseProtocolId(protocol_a), id_a = _a[0], version_a = _a[1];
        var _b = this.parseProtocolId(protocol_b), id_b = _b[0], version_b = _b[1];
        if (id_a !== id_b)
            return false;
        var info_a = this.get(id_a, version_a);
        var info_b = this.get(id_b, version_b);
        if (!info_a || !info_b)
            return false;
        return this.check_version_compatibility(info_a.version, info_b.version)
            .compatible;
    };
    /**
     * Get compatibility matrix
     */
    ProtocolRegistry.prototype.get_compatibility_matrix = function () {
        return __assign({}, this.compatibilityMatrix);
    };
    /**
     * Check version compatibility
     */
    ProtocolRegistry.prototype.check_version_compatibility = function (clientVersion, serverVersion) {
        var issues = [];
        var compatible = true;
        // Major version must match
        if (clientVersion.major !== serverVersion.major) {
            compatible = false;
            issues.push("Major version mismatch: client ".concat(clientVersion.major, " vs server ").concat(serverVersion.major));
        }
        // Client should not be newer than server
        if (compareSemVer(clientVersion, serverVersion) > 0) {
            compatible = false;
            issues.push("Client version newer than server");
        }
        // Check for known compatibility issues
        var level = this.getCompatibilityLevel(clientVersion, serverVersion);
        if (level === "none") {
            compatible = false;
            issues.push("Known incompatibility between versions");
        }
        else if (level === "partial") {
            issues.push("Partial compatibility - some features may not work");
        }
        var recommendation = "use_as_is";
        if (!compatible) {
            recommendation =
                compareSemVer(clientVersion, serverVersion) > 0
                    ? "upgrade_server"
                    : "upgrade_client";
        }
        else if (level === "partial") {
            recommendation = "negotiate";
        }
        return {
            compatible: compatible,
            clientVersion: clientVersion,
            serverVersion: serverVersion,
            issues: issues,
            recommendation: recommendation,
        };
    };
    /**
     * Get compatibility level between two versions
     */
    ProtocolRegistry.prototype.getCompatibilityLevel = function (a, b) {
        // Same version is fully compatible
        if (compareSemVer(a, b) === 0)
            return "full";
        // Different major versions are incompatible
        if (a.major !== b.major)
            return "none";
        // Minor version differences are partially compatible
        if (a.minor !== b.minor)
            return "partial";
        // Patch version differences are fully compatible
        return "full";
    };
    // ========================================================================
    // DEPENDENCIES
    // ========================================================================
    /**
     * Resolve dependencies for a protocol
     */
    ProtocolRegistry.prototype.resolve_dependencies = function (protocolId, version) {
        var graph = new DependencyGraph();
        var queue = [
            { id: protocolId, version: version },
        ];
        while (queue.length > 0) {
            var _a = queue.shift(), id = _a.id, v = _a.version;
            if (graph.getNode(id, v))
                continue;
            var info = this.get(id, v);
            if (!info)
                continue;
            graph.addNode({
                protocolId: id,
                version: v,
                dependencies: info.dependencies,
                dependents: [],
            });
            for (var _i = 0, _b = info.dependencies; _i < _b.length; _i++) {
                var dep = _b[_i];
                if (dep.versionConstraint.exactVersion) {
                    queue.push({
                        id: dep.protocolId,
                        version: dep.versionConstraint.exactVersion,
                    });
                }
            }
        }
        return graph;
    };
    /**
     * Check if all dependencies are satisfied
     */
    ProtocolRegistry.prototype.check_dependencies_satisfied = function (protocolId, version) {
        var info = this.get(protocolId, version);
        if (!info)
            return false;
        for (var _i = 0, _a = info.dependencies; _i < _a.length; _i++) {
            var dep = _a[_i];
            var depInfo = this.get(dep.protocolId, dep.versionConstraint.exactVersion);
            if (!depInfo)
                return false;
            if (dep.versionConstraint.required && depInfo.stability === "retired") {
                return false;
            }
        }
        return true;
    };
    /**
     * Get migration path between versions
     */
    ProtocolRegistry.prototype.get_migration_path = function (fromVersion, toVersion) {
        // Can only migrate within same major version or to next major
        if (toVersion.major < fromVersion.major) {
            return null; // Cannot downgrade
        }
        if (toVersion.major > fromVersion.major + 1) {
            return null; // Cannot skip major versions
        }
        var steps = [];
        var totalEstimatedTime = 0;
        // Direct upgrade within major version
        if (fromVersion.major === toVersion.major) {
            steps.push({
                targetVersion: toVersion,
                type: "upgrade",
                description: "Upgrade from ".concat(formatSemVer(fromVersion), " to ").concat(formatSemVer(toVersion)),
                estimatedTimeMs: 5000,
                automatic: true,
            });
            totalEstimatedTime += 5000;
        }
        // Major version upgrade
        else if (toVersion.major === fromVersion.major + 1) {
            steps.push({
                targetVersion: toVersion,
                type: "migrate_data",
                description: "Migrate from v".concat(fromVersion.major, " to v").concat(toVersion.major),
                estimatedTimeMs: 30000,
                automatic: false,
                manualInstructions: "Review breaking changes and update code accordingly.",
            });
            totalEstimatedTime += 30000;
        }
        var isAutomatic = steps.every(function (s) { return s.automatic; });
        var estimatedEffort;
        if (totalEstimatedTime < 10000)
            estimatedEffort = "trivial";
        else if (totalEstimatedTime < 60000)
            estimatedEffort = "easy";
        else if (totalEstimatedTime < 300000)
            estimatedEffort = "moderate";
        else
            estimatedEffort = "complex";
        return {
            fromVersion: fromVersion,
            toVersion: toVersion,
            steps: steps,
            totalEstimatedTimeMs: totalEstimatedTime,
            isAutomatic: isAutomatic,
            estimatedEffort: estimatedEffort,
        };
    };
    // ========================================================================
    // STATUS
    // ========================================================================
    /**
     * Check if protocol is stable
     */
    ProtocolRegistry.prototype.is_stable = function (protocolId, version) {
        var info = this.get(protocolId, version);
        return info !== undefined && info.stability === "stable";
    };
    /**
     * Check if protocol is deprecated
     */
    ProtocolRegistry.prototype.is_deprecated = function (protocolId, version) {
        var info = this.get(protocolId, version);
        return info !== undefined && info.stability === "deprecated";
    };
    /**
     * Get deprecation info
     */
    ProtocolRegistry.prototype.get_deprecation_info = function (protocolId, version) {
        var info = this.get(protocolId, version);
        return info === null || info === void 0 ? void 0 : info.deprecation;
    };
    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================
    /**
     * Parse protocol ID with optional version
     */
    ProtocolRegistry.prototype.parseProtocolId = function (id) {
        var match = id.match(/^(@?[\w-]+)(?:@(.+))?$/);
        if (!match)
            return [id, undefined];
        var protocolId = match[1];
        var versionStr = match[2];
        var version = versionStr ? parseSemVer(versionStr) : undefined;
        return [protocolId, version];
    };
    /**
     * Initialize built-in protocols
     */
    ProtocolRegistry.prototype.initializeBuiltInProtocols = function () {
        // ATP (Autonomous Task Processing) Protocol
        this.register({
            id: "atp",
            name: "Autonomous Task Processing",
            description: "Single-model query processing protocol",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [],
        });
        // ACP (Assisted Collaborative Processing) Protocol
        this.register({
            id: "acp",
            name: "Assisted Collaborative Processing",
            description: "Multi-model collaboration protocol",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [
                {
                    protocolId: "atp",
                    versionConstraint: {
                        exactVersion: { major: 1, minor: 0, patch: 0 },
                        required: true,
                    },
                },
            ],
        });
        // Cartridge Protocol
        this.register({
            id: "cartridge",
            name: "Knowledge Cartridge",
            description: "Knowledge cartridge lifecycle management",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [],
        });
        // Version Negotiation Protocol
        this.register({
            id: "version-negotiation",
            name: "Version Negotiation",
            description: "Protocol version negotiation and compatibility",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [],
        });
        // Rollback Protocol
        this.register({
            id: "rollback",
            name: "Rollback",
            description: "Distributed rollback operations",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [],
        });
        // Hypothesis Protocol
        this.register({
            id: "hypothesis",
            name: "Hypothesis Testing",
            description: "Distributed hypothesis testing and validation",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [],
        });
        // Extension Protocol
        this.register({
            id: "extension",
            name: "Extension",
            description: "Protocol extension framework",
            version: { major: 1, minor: 0, patch: 0 },
            stability: "stable",
            releasedAt: new Date("2025-12-30"),
            minCompatibleVersion: { major: 1, minor: 0, patch: 0 },
            dependencies: [],
        });
    };
    return ProtocolRegistry;
}());
exports.ProtocolRegistry = ProtocolRegistry;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
/**
 * Global protocol registry instance
 */
exports.globalProtocolRegistry = new ProtocolRegistry();
