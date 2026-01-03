"use strict";
/**
 * Cartridge Protocol for Aequor Cognitive Orchestration Platform
 *
 * This module defines the protocol for knowledge cartridges - self-contained units of
 * domain knowledge that can be loaded, unloaded, and versioned in the ContextPlane.
 *
 * Cartridges enable:
 * - Modular knowledge organization
 * - Version negotiation and dependency resolution
 * - Hot-reloading without restart
 * - Cryptographic verification and signing
 *
 * Design Principles:
 * - Protocol-first: All types defined here before implementation
 * - Semantic versioning for compatibility
 * - Dependency resolution with conflict detection
 * - Graceful failure handling with rollback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartridgeState = void 0;
/**
 * Cartridge lifecycle states
 *
 * Cartridges transition through these states during their lifetime.
 */
var CartridgeState;
(function (CartridgeState) {
    /** Cartridge is not loaded */
    CartridgeState["UNLOADED"] = "unloaded";
    /** Cartridge is currently loading */
    CartridgeState["LOADING"] = "loading";
    /** Cartridge is loaded and available */
    CartridgeState["LOADED"] = "loaded";
    /** Cartridge is currently unloading */
    CartridgeState["UNLOADING"] = "unloading";
    /** Cartridge encountered an error */
    CartridgeState["ERROR"] = "error";
})(CartridgeState || (exports.CartridgeState = CartridgeState = {}));
