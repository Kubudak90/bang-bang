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
 * This mirrors the server's movement logic
 */
export function applyInput(player, input, deltaTime, map) {
    const speed = PLAYER.MOVE_SPEED * deltaTime;
    const rotSpeed = PLAYER.ROTATION_SPEED * deltaTime;

    // Apply rotation
    if (input.lookDelta !== undefined) {
        player.angle += input.lookDelta;
    }
    if (input.turnLeft) {
        player.angle -= rotSpeed;
    }
    if (input.turnRight) {
        player.angle += rotSpeed;
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

    // Apply movement with collision (sliding)
    if (moveX !== 0 || moveY !== 0) {
        const newX = player.x + moveX;
        const newY = player.y + moveY;

        // Check collision (if map provided)
        if (map) {
            if (!map.isWall(Math.floor(newX), Math.floor(player.y))) {
                player.x = newX;
            }
            if (!map.isWall(Math.floor(player.x), Math.floor(newY))) {
                player.y = newY;
            }
        } else {
            // No collision check (server will validate)
            player.x = newX;
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

    // If error is small enough, just smooth towards server position
    if (error < NETWORK.RECONCILE_THRESHOLD) {
        // Smooth correction (lerp towards server)
        const smoothFactor = 0.1;
        localPlayer.x += (serverState.x - localPlayer.x) * smoothFactor;
        localPlayer.y += (serverState.y - localPlayer.y) * smoothFactor;
        return false;
    }

    // Large error - snap and re-simulate
    console.log(`Reconciling: error=${error.toFixed(3)}, lastProcessed=${lastProcessedSeq}`);

    // Snap to server position
    localPlayer.x = serverState.x;
    localPlayer.y = serverState.y;
    localPlayer.angle = serverState.angle;

    // Remove processed inputs
    while (inputHistory.length > 0 && inputHistory[0].seq <= lastProcessedSeq) {
        inputHistory.shift();
    }

    // Re-apply unprocessed inputs
    const tickTime = NETWORK.TICK_INTERVAL / 1000; // Approximate delta time
    for (const record of inputHistory) {
        applyInput(localPlayer, record.input, tickTime, map);
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
