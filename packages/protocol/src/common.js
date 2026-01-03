"use strict";
/**
 * @fileoverview Common Base Types for Aequor Platform
 *
 * This module provides foundational type abstractions used across all packages.
 * These base types eliminate duplication and ensure consistency in:
 * - Configuration objects
 * - Result/Response patterns
 * - Request/Response patterns
 * - State management
 * - Event handling
 * - Status tracking
 *
 * @module @lsi/protocol/common
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequestId = createRequestId;
exports.createEventId = createEventId;
/**
 * Create a branded ID
 */
function createRequestId(id) {
    return id;
}
/**
 * Create an event ID
 */
function createEventId(id) {
    return id;
}
