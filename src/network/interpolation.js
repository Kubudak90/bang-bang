// Interpolation - Smooth remote player rendering
// Buffer server states and render slightly behind real-time

import { NETWORK } from './protocol.js';

// ============================================
// STATE BUFFER
// ============================================

/**
 * Create a new state buffer for an entity
 */
export function createStateBuffer() {
    return {
        states: [],
        renderX: 0,
        renderY: 0,
        renderAngle: 0
    };
}

/**
 * Add a state to the buffer
 */
export function addState(buffer, state) {
    buffer.states.push({
        x: state.x,
        y: state.y,
        angle: state.angle,
        health: state.health,
        weapon: state.weapon,
        timestamp: Date.now()
    });

    // Limit buffer size
    while (buffer.states.length > NETWORK.STATE_BUFFER_SIZE) {
        buffer.states.shift();
    }
}

// ============================================
// INTERPOLATION
// ============================================

/**
 * Update entity's render position using interpolation
 * Renders 100ms behind real-time for smooth movement
 */
export function interpolate(buffer, currentTime = Date.now()) {
    if (buffer.states.length < 2) {
        // Not enough states - use latest
        if (buffer.states.length === 1) {
            const state = buffer.states[0];
            buffer.renderX = state.x;
            buffer.renderY = state.y;
            buffer.renderAngle = state.angle;
        }
        return;
    }

    // Render time is in the past
    const renderTime = currentTime - NETWORK.INTERPOLATION_DELAY;

    // Find surrounding states
    let before = null;
    let after = null;

    for (let i = 0; i < buffer.states.length - 1; i++) {
        if (buffer.states[i].timestamp <= renderTime &&
            buffer.states[i + 1].timestamp >= renderTime) {
            before = buffer.states[i];
            after = buffer.states[i + 1];
            break;
        }
    }

    // If render time is older than all states, use oldest
    if (!before && buffer.states[0].timestamp > renderTime) {
        const state = buffer.states[0];
        buffer.renderX = state.x;
        buffer.renderY = state.y;
        buffer.renderAngle = state.angle;
        return;
    }

    // If render time is newer than all states, extrapolate from latest
    if (!before) {
        const latest = buffer.states[buffer.states.length - 1];
        const prev = buffer.states[buffer.states.length - 2];

        // Calculate velocity
        const dt = (latest.timestamp - prev.timestamp) / 1000;
        if (dt > 0) {
            const vx = (latest.x - prev.x) / dt;
            const vy = (latest.y - prev.y) / dt;

            // Extrapolate (with limit to prevent runaway)
            const extrapolateTime = Math.min((renderTime - latest.timestamp) / 1000, 0.2);
            buffer.renderX = latest.x + vx * extrapolateTime;
            buffer.renderY = latest.y + vy * extrapolateTime;
            buffer.renderAngle = latest.angle;
        } else {
            buffer.renderX = latest.x;
            buffer.renderY = latest.y;
            buffer.renderAngle = latest.angle;
        }
        return;
    }

    // Interpolate between before and after
    const total = after.timestamp - before.timestamp;
    const progress = (renderTime - before.timestamp) / total;
    const t = Math.max(0, Math.min(1, progress));

    buffer.renderX = lerp(before.x, after.x, t);
    buffer.renderY = lerp(before.y, after.y, t);
    buffer.renderAngle = lerpAngle(before.angle, after.angle, t);
}

// ============================================
// LERP FUNCTIONS
// ============================================

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Angle interpolation (handles wraparound)
 */
function lerpAngle(a, b, t) {
    // Normalize angles
    a = normalizeAngle(a);
    b = normalizeAngle(b);

    // Find shortest path
    let diff = b - a;
    if (diff > Math.PI) {
        diff -= Math.PI * 2;
    } else if (diff < -Math.PI) {
        diff += Math.PI * 2;
    }

    return normalizeAngle(a + diff * t);
}

function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

// ============================================
// UTILITY
// ============================================

/**
 * Get latest state from buffer
 */
export function getLatestState(buffer) {
    if (buffer.states.length === 0) return null;
    return buffer.states[buffer.states.length - 1];
}

/**
 * Clear buffer
 */
export function clearBuffer(buffer) {
    buffer.states.length = 0;
    buffer.renderX = 0;
    buffer.renderY = 0;
    buffer.renderAngle = 0;
}

/**
 * Get buffer delay (how far behind we're rendering)
 */
export function getBufferDelay(buffer) {
    if (buffer.states.length === 0) return 0;
    const latest = buffer.states[buffer.states.length - 1];
    return Date.now() - latest.timestamp;
}
