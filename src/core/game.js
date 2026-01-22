// Game - global state yönetimi (Multiplayer version)

import { DEBUG } from './config.js';

/**
 * Global oyun state'i
 * Tek kaynak - tüm modüller buradan okur
 */
export const game = {
    // Core
    isRunning: false,
    isPaused: false,
    isGameOver: false,
    levelComplete: false,

    // Mode
    mode: 'singleplayer', // 'singleplayer' or 'multiplayer'

    // Zaman
    lastTime: 0,
    deltaTime: 0,
    fps: 0,
    frameCount: 0,
    fpsTime: 0,

    // Referanslar (init'te atanır)
    canvas: null,
    ctx: null,
    player: null,  // Local player (single player mode)
    map: null,

    // === MULTIPLAYER STATE ===

    // Network
    clientId: null,         // Local player's ID
    roomId: null,           // Current room ID
    serverTick: 0,          // Last received server tick
    ping: 0,                // Network latency in ms

    // Players (multiplayer)
    players: new Map(),     // All players: playerId → PlayerState
    localPlayer: null,      // Reference to local player in players map

    // Match state
    matchState: 'waiting',  // waiting, countdown, playing, ended
    matchTime: 0,           // Remaining time in seconds
    matchDuration: 300,     // Total match duration
    countdownTime: 0,       // Countdown before match

    // Scores
    scores: {},             // playerId → { kills, deaths }
    killFeed: [],           // Recent kills for display

    // World (server-controlled in multiplayer)
    mapSeed: null,
    loots: [],

    // === SINGLE PLAYER STATE ===

    // Oyun durumu (single player)
    level: 1,
    score: 0,
    enemies: [],

    // === SHARED STATE ===

    // Farcaster user
    farcasterUser: null,

    // Görsel efektler
    damageFlash: null,
    pickupFlash: null,
    showScoreboard: false,

    // Debug
    debug: {
        noclip: false,
        godmode: false,
        showRays: DEBUG.SHOW_RAYS,
        showMinimap: DEBUG.SHOW_MINIMAP,
        showFps: DEBUG.SHOW_FPS,
        showNetStats: false
    }
};

/**
 * Delta time güncelle
 * Frame-bağımsız fizik için zorunlu
 */
export function updateDeltaTime(currentTime) {
    game.deltaTime = (currentTime - game.lastTime) / 1000; // saniyeye çevir
    game.lastTime = currentTime;

    // Delta time sınırla (tab değişikliğinde patlama önleme)
    if (game.deltaTime > 0.1) {
        game.deltaTime = 0.1;
    }
}

/**
 * FPS hesapla
 */
export function updateFps(currentTime) {
    game.frameCount++;

    if (currentTime - game.fpsTime >= 1000) {
        game.fps = game.frameCount;
        game.frameCount = 0;
        game.fpsTime = currentTime;
    }
}

// ============================================
// MULTIPLAYER HELPERS
// ============================================

/**
 * Initialize multiplayer state
 */
export function initMultiplayerState() {
    game.mode = 'multiplayer';
    game.players.clear();
    game.scores = {};
    game.killFeed = [];
    game.matchState = 'waiting';
    game.matchTime = 0;
    game.clientId = null;
    game.roomId = null;
    game.localPlayer = null;

    // Clear singleplayer entities
    game.enemies = [];
    game.loots = [];
}

/**
 * Add a player to the game
 */
export function addPlayer(playerId, playerData) {
    const player = {
        id: playerId,
        username: playerData.username || `Player${playerId}`,
        displayName: playerData.displayName || playerData.username,

        // Position
        x: playerData.x || 5,
        y: playerData.y || 5,
        angle: playerData.angle || 0,
        pitch: 0, // Dikey bakış

        // State
        health: playerData.health || 100,
        maxHealth: 100,
        weapon: playerData.weapon || 'pistol',
        state: playerData.state || 'alive',

        // For interpolation (remote players)
        stateBuffer: [],
        renderX: playerData.x || 5,
        renderY: playerData.y || 5,
        renderAngle: playerData.angle || 0,

        // Visual
        color: playerData.color || '#ff4444'
    };

    game.players.set(playerId, player);
    game.scores[playerId] = { kills: 0, deaths: 0 };

    return player;
}

/**
 * Remove a player from the game
 */
export function removePlayer(playerId) {
    game.players.delete(playerId);
    delete game.scores[playerId];
}

/**
 * Update player state from server
 */
export function updatePlayerState(playerId, state) {
    const player = game.players.get(playerId);
    if (!player) return;

    // For local player: used in reconciliation
    // For remote players: add to state buffer for interpolation
    if (playerId === game.clientId) {
        // Local player - direct update (reconciliation handles prediction)
        player.health = state.health;
        player.weapon = state.weapon;
        player.state = state.state;
    } else {
        // Remote player - add to state buffer
        player.stateBuffer.push({
            x: state.x,
            y: state.y,
            angle: state.angle,
            health: state.health,
            weapon: state.weapon,
            state: state.state,
            timestamp: Date.now()
        });

        // Limit buffer size
        while (player.stateBuffer.length > 20) {
            player.stateBuffer.shift();
        }
    }
}

/**
 * Add kill to feed
 */
export function addKillToFeed(killer, killerName, victim, victimName, weapon) {
    game.killFeed.push({
        killer,
        killerName,
        victim,
        victimName,
        weapon,
        time: Date.now()
    });

    // Keep last 5 kills
    while (game.killFeed.length > 5) {
        game.killFeed.shift();
    }
}

/**
 * Get local player
 */
export function getLocalPlayer() {
    if (game.mode === 'multiplayer') {
        return game.localPlayer;
    }
    return game.player;
}

/**
 * Get all players as array (for rendering)
 */
export function getAllPlayers() {
    return Array.from(game.players.values());
}

/**
 * Check if a player is local
 */
export function isLocalPlayer(playerId) {
    return playerId === game.clientId;
}

/**
 * Reset game state for new match
 */
export function resetMatchState() {
    game.matchState = 'waiting';
    game.matchTime = game.matchDuration;
    game.killFeed = [];

    for (const [playerId, score] of Object.entries(game.scores)) {
        game.scores[playerId] = { kills: 0, deaths: 0 };
    }
}
