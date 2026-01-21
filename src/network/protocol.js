// Protocol - Network message types & serialization
// Binary protocol for efficient data transfer

// ============================================
// MESSAGE TYPES
// ============================================

// Client → Server
export const C2S = {
    JOIN: 0x01,         // Join game request
    INPUT: 0x02,        // Player input state
    PING: 0x03,         // Latency measurement
    SHOOT: 0x04,        // Fire weapon
    SWITCH_WEAPON: 0x05 // Change weapon
};

// Server → Client
export const S2C = {
    JOINED: 0x10,       // Successfully joined
    STATE: 0x11,        // Game state update
    PLAYER_JOIN: 0x12,  // New player joined
    PLAYER_LEAVE: 0x13, // Player left
    HIT: 0x14,          // Damage dealt
    KILL: 0x15,         // Player killed
    RESPAWN: 0x16,      // Player respawned
    MATCH_START: 0x17,  // Match beginning
    MATCH_END: 0x18,    // Match finished
    PING: 0x19,         // Pong response
    ERROR: 0xFF         // Error message
};

// ============================================
// GAME CONSTANTS
// ============================================

export const NETWORK = {
    TICK_RATE: 20,              // Server ticks per second
    TICK_INTERVAL: 1000 / 20,   // 50ms per tick
    INPUT_BUFFER_SIZE: 64,      // Input history for reconciliation
    STATE_BUFFER_SIZE: 20,      // State history for interpolation
    INTERPOLATION_DELAY: 100,   // ms behind server time for smooth rendering
    RECONCILE_THRESHOLD: 0.5,   // Position error threshold for correction
    MAX_PLAYERS: 8,
    MATCH_DURATION: 300,        // 5 minutes
    RESPAWN_TIME: 3             // seconds
};

// ============================================
// MESSAGE ENCODING/DECODING
// ============================================

/**
 * Encode a message to JSON (simple protocol)
 * TODO: Switch to binary (MessagePack/protobuf) for production
 */
export function encodeMessage(type, payload) {
    return JSON.stringify({
        t: type,
        d: payload,
        ts: Date.now()
    });
}

/**
 * Decode a message from JSON
 */
export function decodeMessage(data) {
    try {
        const msg = JSON.parse(data);
        return {
            type: msg.t,
            payload: msg.d,
            timestamp: msg.ts
        };
    } catch (e) {
        console.error('Failed to decode message:', e);
        return null;
    }
}

// ============================================
// INPUT STATE
// ============================================

/**
 * Encode input state for transmission
 * Compact format: 1 byte flags + 2 bytes angle
 */
export function encodeInput(input) {
    // Pack movement flags into single byte
    let flags = 0;
    if (input.forward) flags |= 0x01;
    if (input.backward) flags |= 0x02;
    if (input.left) flags |= 0x04;
    if (input.right) flags |= 0x08;
    if (input.shoot) flags |= 0x10;

    return {
        seq: input.seq,         // Sequence number for reconciliation
        f: flags,               // Movement flags
        a: Math.round(input.angle * 1000) / 1000,  // Angle (3 decimal places)
        w: input.weapon         // Current weapon
    };
}

/**
 * Decode input state
 */
export function decodeInput(data) {
    return {
        seq: data.seq,
        forward: !!(data.f & 0x01),
        backward: !!(data.f & 0x02),
        left: !!(data.f & 0x04),
        right: !!(data.f & 0x08),
        shoot: !!(data.f & 0x10),
        angle: data.a,
        weapon: data.w
    };
}

// ============================================
// PLAYER STATE
// ============================================

/**
 * Encode player state for transmission
 */
export function encodePlayerState(player) {
    return {
        id: player.id,
        x: Math.round(player.x * 100) / 100,
        y: Math.round(player.y * 100) / 100,
        a: Math.round(player.angle * 1000) / 1000,
        h: player.health,
        w: player.weapon,
        s: player.state  // 'alive', 'dead', 'spectating'
    };
}

/**
 * Decode player state
 */
export function decodePlayerState(data) {
    return {
        id: data.id,
        x: data.x,
        y: data.y,
        angle: data.a,
        health: data.h,
        weapon: data.w,
        state: data.s
    };
}

// ============================================
// GAME STATE SNAPSHOT
// ============================================

/**
 * Encode full game state
 */
export function encodeGameState(state) {
    return {
        tick: state.tick,
        time: state.matchTime,
        players: state.players.map(encodePlayerState),
        scores: state.scores,
        loots: state.loots.map(l => ({
            id: l.id,
            x: Math.round(l.x * 100) / 100,
            y: Math.round(l.y * 100) / 100,
            t: l.type
        }))
    };
}

/**
 * Decode game state
 */
export function decodeGameState(data) {
    return {
        tick: data.tick,
        matchTime: data.time,
        players: data.players.map(decodePlayerState),
        scores: data.scores,
        loots: data.loots.map(l => ({
            id: l.id,
            x: l.x,
            y: l.y,
            type: l.t
        }))
    };
}

// ============================================
// EVENT MESSAGES
// ============================================

/**
 * Create join request
 */
export function createJoinMessage(fid, username, displayName) {
    return encodeMessage(C2S.JOIN, {
        fid,
        username,
        displayName
    });
}

/**
 * Create input message
 */
export function createInputMessage(input) {
    return encodeMessage(C2S.INPUT, encodeInput(input));
}

/**
 * Create ping message
 */
export function createPingMessage() {
    return encodeMessage(C2S.PING, { t: Date.now() });
}

/**
 * Create shoot message
 */
export function createShootMessage(angle, weapon) {
    return encodeMessage(C2S.SHOOT, {
        a: Math.round(angle * 1000) / 1000,
        w: weapon
    });
}
