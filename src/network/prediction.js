// Prediction - Client-side prediction & server reconciliation
// Provides responsive movement while maintaining server authority

import { NETWORK } from './protocol.js';
import { PLAYER } from '../core/config.js';

// ============================================
// INPUT HISTORY
// ============================================

const inputHistory = [];
let inputSequence = 0;

/**
 * Clear input history
 */
export function clearInputHistory() {
    inputHistory.length = 0;
    inputSequence = 0;
}

/**
 * Get current input sequence number
 */
export function getInputSequence() {
    return inputSequence;
}

/**
 * Record input for later reconciliation
 */
export function recordInput(input, playerState) {
    inputSequence++;

    // Store input with sequence and resulting state
    inputHistory.push({
        seq: inputSequence,
        input: { ...input },
        state: {
            x: playerState.x,
            y: playerState.y,
            angle: playerState.angle
        },
        timestamp: Date.now()
    });

    // Limit history size
    while (inputHistory.length > NETWORK.INPUT_BUFFER_SIZE) {
        inputHistory.shift();
    }

    return inputSequence;
}

// ============================================
// PREDICTION
// ============================================

/**
 * Apply input to player state (prediction)
 * This mirrors the server's movement logic exactly
 * NOTE: Server uses speed=5.0, no wall collision (only boundary)
 */
export function applyInput(player, input, deltaTime, map) {
    // Match server speed exactly
    const speed = 5.0 * deltaTime;

    // Apply rotation from angle directly (server behavior)
    if (input.angle !== undefined) {
        player.angle = input.angle;
    }

    // Normalize angle
    player.angle = normalizeAngle(player.angle);

    // Calculate movement
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    let moveX = 0;
    let moveY = 0;

    if (input.forward) {
        moveX += cos * speed;
        moveY += sin * speed;
    }
    if (input.backward) {
        moveX -= cos * speed;
        moveY -= sin * speed;
    }
    if (input.left) {
        moveX += sin * speed;
        moveY -= cos * speed;
    }
    if (input.right) {
        moveX -= sin * speed;
        moveY += cos * speed;
    }

    // Apply movement - match server (boundary only, no wall collision)
    if (moveX !== 0 || moveY !== 0) {
        const newX = player.x + moveX;
        const newY = player.y + moveY;

        // Server uses mapSize for boundary, we use map.width
        const mapSize = map ? map.width : 32;

        // Boundary check only (same as server)
        if (newX > 1 && newX < mapSize - 1) {
            player.x = newX;
        }
        if (newY > 1 && newY < mapSize - 1) {
            player.y = newY;
        }
    }
}

// ============================================
// RECONCILIATION
// ============================================

/**
 * Reconcile local state with server state
 * Re-apply unprocessed inputs after correction
 */
export function reconcile(localPlayer, serverState, map) {
    const lastProcessedSeq = serverState.lastProcessedInput;

    // Find position error
    const errorX = Math.abs(localPlayer.x - serverState.x);
    const errorY = Math.abs(localPlayer.y - serverState.y);
    const error = Math.sqrt(errorX * errorX + errorY * errorY);

    // Always smooth towards server position (less jarring)
    const smoothFactor = NETWORK.SMOOTH_FACTOR || 0.2;

    // If error is small enough, just smooth towards server position
    if (error < NETWORK.RECONCILE_THRESHOLD) {
        localPlayer.x += (serverState.x - localPlayer.x) * smoothFactor;
        localPlayer.y += (serverState.y - localPlayer.y) * smoothFactor;
        // Also smooth angle
        const angleDiff = serverState.angle - localPlayer.angle;
        localPlayer.angle += angleDiff * smoothFactor * 0.5;
        return false;
    }

    // Large error - use stronger correction but still smooth
    const strongSmooth = Math.min(0.5, smoothFactor * 2);
    localPlayer.x += (serverState.x - localPlayer.x) * strongSmooth;
    localPlayer.y += (serverState.y - localPlayer.y) * strongSmooth;
    localPlayer.angle = serverState.angle;

    // Remove processed inputs
    while (inputHistory.length > 0 && inputHistory[0].seq <= lastProcessedSeq) {
        inputHistory.shift();
    }

    // Only re-simulate if error is very large
    if (error > NETWORK.RECONCILE_THRESHOLD * 2) {
        console.log(`Hard reconcile: error=${error.toFixed(3)}`);
        localPlayer.x = serverState.x;
        localPlayer.y = serverState.y;

        // Re-apply unprocessed inputs
        const tickTime = NETWORK.TICK_INTERVAL / 1000;
        for (const record of inputHistory) {
            applyInput(localPlayer, record.input, tickTime, map);
        }
    }

    return true;
}

// ============================================
// HELPERS
// ============================================

function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

/**
 * Get pending inputs count (unconfirmed by server)
 */
export function getPendingInputsCount() {
    return inputHistory.length;
}

/**
 * Get last recorded state (for debugging)
 */
export function getLastRecordedState() {
    if (inputHistory.length === 0) return null;
    return inputHistory[inputHistory.length - 1].state;
}
