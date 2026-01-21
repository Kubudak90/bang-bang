// Main - oyun giriş noktası ve ana döngü
// Supports both singleplayer and multiplayer modes

import { SCREEN, NETWORK, PLAYER_COLORS } from './core/config.js';
import {
    game, updateFps, updateDeltaTime,
    initMultiplayerState, addPlayer, removePlayer,
    updatePlayerState, addKillToFeed, getLocalPlayer, getAllPlayers
} from './core/game.js';
import { initAudio, playSound } from './core/audio.js';
import { initKeyboard, getKeys } from './input/keyboard.js';
import { initMouse, consumeMouseDelta } from './input/mouse.js';
import { initTouchControls, getTouchControls, isTouchDevice } from './input/touchControls.js';
import { createPlayer, updatePlayer } from './player/player.js';
import { initWeapons, updateWeapon, getCurrentWeapon } from './player/weapon.js';
import { generateMap } from './world/mapGenerator.js';
import { spawnEnemy, updateAllEnemies } from './enemies/enemy.js';
import { updateLoots, spawnLootsFromMap, clearLoots } from './world/loot.js';
import { castRays } from './engine/raycaster.js';
import { renderWorld, clearScreen } from './engine/renderer.js';
import { initTextures } from './engine/textures.js';
import { renderSprites } from './engine/spriteRenderer.js';
import { renderMinimap } from './ui/minimap.js';
import { renderWeapon } from './ui/weaponRenderer.js';
import { updateDebugInfo, renderHud } from './ui/hud.js';

// Network imports
import { gameClient } from './network/client.js';
import { applyInput, recordInput, reconcile, clearInputHistory } from './network/prediction.js';
import { createStateBuffer, addState, interpolate } from './network/interpolation.js';

// Farcaster imports
import { initMiniApp, getUser } from './farcaster/miniApp.js';

// ============================================
// STATE
// ============================================

let currentLevel = 1;
let gameMode = 'menu'; // 'menu', 'singleplayer', 'multiplayer', 'connecting'

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    // Canvas setup
    const canvas = document.getElementById('game-canvas');
    canvas.width = SCREEN.WIDTH;
    canvas.height = SCREEN.HEIGHT;
    canvas.style.width = `${SCREEN.WIDTH * SCREEN.SCALE}px`;
    canvas.style.height = `${SCREEN.HEIGHT * SCREEN.SCALE}px`;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Global referansları kaydet
    game.canvas = canvas;
    game.ctx = ctx;

    // Texture'ları oluştur
    initTextures();

    // Input sistemlerini başlat
    initKeyboard();
    initMouse(canvas);
    initTouchControls(canvas);
    initWeapons();

    // Farcaster init (if available)
    try {
        await initMiniApp();
        const user = getUser();
        if (user) {
            game.farcasterUser = user;
            console.log(`Farcaster user: ${user.username}`);
        }
    } catch (e) {
        console.log('Running outside Farcaster');
    }

    // Debug komutlarını window'a ekle
    setupDebugCommands();

    // İlk ses için click gerekli
    document.addEventListener('click', () => initAudio(), { once: true });

    // Show menu or auto-start based on URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'multi') {
        startMultiplayer();
    } else if (params.get('mode') === 'single') {
        startSingleplayer();
    } else {
        showMenu();
    }

    console.log('🎮 Bang Bang initialized');
}

// ============================================
// MENU
// ============================================

function showMenu() {
    gameMode = 'menu';
    game.isRunning = true;
    game.lastTime = performance.now();
    requestAnimationFrame(menuLoop);
}

function menuLoop(currentTime) {
    if (gameMode !== 'menu') return;

    updateDeltaTime(currentTime);
    updateFps(currentTime);

    const ctx = game.ctx;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);

    // Title
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BANG BANG', SCREEN.WIDTH / 2, 100);

    // Subtitle
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText('2D Raycasting FPS', SCREEN.WIDTH / 2, 130);

    // Farcaster user
    if (game.farcasterUser) {
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '14px monospace';
        ctx.fillText(`Welcome, ${game.farcasterUser.username}!`, SCREEN.WIDTH / 2, 160);
    }

    // Menu options
    const menuY = 220;

    // Singleplayer button
    drawButton(ctx, SCREEN.WIDTH / 2, menuY, 'SINGLEPLAYER [1]', '#0f3460');

    // Multiplayer button
    drawButton(ctx, SCREEN.WIDTH / 2, menuY + 60, 'MULTIPLAYER [2]', '#e94560');

    // Controls hint
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText('WASD: Move | Mouse: Look | Click: Shoot', SCREEN.WIDTH / 2, SCREEN.HEIGHT - 40);

    if (isTouchDevice()) {
        ctx.fillText('Touch: Left stick move, Right stick aim', SCREEN.WIDTH / 2, SCREEN.HEIGHT - 20);
    }

    ctx.textAlign = 'left';

    // Handle input
    const keys = getKeys();
    if (keys.forward) { // W key or 1
        startSingleplayer();
        return;
    }

    // Check for key press
    document.onkeydown = (e) => {
        if (gameMode !== 'menu') return;
        if (e.key === '1') startSingleplayer();
        if (e.key === '2') startMultiplayer();
    };

    // Check for touch/click
    game.canvas.onclick = (e) => {
        if (gameMode !== 'menu') return;
        const rect = game.canvas.getBoundingClientRect();
        const y = (e.clientY - rect.top) * (SCREEN.HEIGHT / rect.height);

        if (y > menuY - 25 && y < menuY + 25) {
            startSingleplayer();
        } else if (y > menuY + 35 && y < menuY + 85) {
            startMultiplayer();
        }
    };

    requestAnimationFrame(menuLoop);
}

function drawButton(ctx, x, y, text, color) {
    const width = 200;
    const height = 40;

    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.textBaseline = 'alphabetic';
}

// ============================================
// SINGLEPLAYER MODE
// ============================================

function startSingleplayer() {
    gameMode = 'singleplayer';
    game.mode = 'singleplayer';
    game.isGameOver = false;
    game.levelComplete = false;
    currentLevel = 1;

    // Oyuncu oluştur
    game.player = createPlayer();

    // Level başlat
    startLevel(currentLevel);

    // Oyunu başlat
    game.isRunning = true;
    game.lastTime = performance.now();

    console.log('🎮 Singleplayer mode started');
    console.log('📋 Kontroller: WASD hareket, Mouse nişan, Click ateş');

    requestAnimationFrame(singleplayerLoop);
}

function startLevel(level) {
    currentLevel = level;
    game.level = level;
    game.enemies = [];
    clearLoots();

    const mapSize = 24 + Math.min(level * 4, 24);
    game.map = generateMap(mapSize, mapSize, Date.now());

    game.player.x = game.map.spawnPoint.x;
    game.player.y = game.map.spawnPoint.y;
    game.player.angle = 0;

    spawnEnemiesForLevel(level);
    spawnLootsFromMap(game.map.lootSpawns);

    console.log(`🗺️ Level ${level} başladı! Harita: ${mapSize}x${mapSize}`);
}

function spawnEnemiesForLevel(level) {
    const enemySpawns = game.map.enemySpawns;
    const types = ['grunt', 'shooter', 'charger'];

    for (const spawn of enemySpawns) {
        let typeIndex;
        const roll = Math.random();

        if (level <= 2) {
            typeIndex = roll < 0.8 ? 0 : 1;
        } else if (level <= 4) {
            typeIndex = roll < 0.5 ? 0 : (roll < 0.85 ? 1 : 2);
        } else {
            typeIndex = roll < 0.3 ? 0 : (roll < 0.6 ? 1 : 2);
        }

        const type = types[typeIndex];
        const enemy = spawnEnemy(type, spawn.x, spawn.y);

        if (enemy && level > 1) {
            const bonus = 1 + (level - 1) * 0.15;
            enemy.health = Math.floor(enemy.health * bonus);
            enemy.maxHealth = enemy.health;
            enemy.damage = Math.floor(enemy.damage * bonus);
        }
    }
}

function singleplayerLoop(currentTime) {
    if (gameMode !== 'singleplayer' || !game.isRunning) return;

    updateDeltaTime(currentTime);
    updateFps(currentTime);

    // UPDATE
    if (!game.isPaused && !game.isGameOver && !game.levelComplete) {
        updatePlayer(game.player, game.map);
        updateWeapon(game.deltaTime);
        updateAllEnemies(game.player, game.map, game.deltaTime);
        updateLoots(game.player, game.deltaTime);

        // Level complete check
        if (game.enemies.length === 0) {
            game.levelComplete = true;
            setTimeout(() => {
                game.levelComplete = false;
                startLevel(currentLevel + 1);
            }, 2000);
        }
    }

    // RENDER
    renderGame(game.player);

    if (game.levelComplete) {
        renderLevelComplete(game.ctx);
    }

    requestAnimationFrame(singleplayerLoop);
}

// ============================================
// MULTIPLAYER MODE
// ============================================

function startMultiplayer() {
    gameMode = 'connecting';
    initMultiplayerState();

    // Show connecting screen
    renderConnectingScreen();

    // Setup network callbacks
    setupNetworkCallbacks();

    // Connect to server
    const serverUrl = NETWORK.SERVER_URL;
    const user = game.farcasterUser || {
        fid: Math.floor(Math.random() * 1000000),
        username: `Player${Math.floor(Math.random() * 1000)}`,
        displayName: 'Guest'
    };

    console.log(`Connecting to ${serverUrl}...`);
    gameClient.connect(serverUrl, user);
}

function setupNetworkCallbacks() {
    gameClient.on('connect', () => {
        console.log('Connected to server');
    });

    gameClient.on('joined', (data) => {
        console.log(`Joined room ${data.roomId} as ${data.playerId}`);

        game.clientId = data.playerId;
        game.roomId = data.roomId;
        game.mapSeed = data.mapSeed;

        // Generate map from seed
        game.map = generateMap(32, 32, data.mapSeed);

        // Add existing players
        data.players.forEach((p, index) => {
            const player = addPlayer(p.id, {
                ...p,
                color: PLAYER_COLORS[index % PLAYER_COLORS.length]
            });

            // Create state buffer for interpolation
            player.stateBuffer = [];

            if (p.id === data.playerId) {
                game.localPlayer = player;
            }
        });

        // Start multiplayer loop
        gameMode = 'multiplayer';
        game.mode = 'multiplayer';
        game.isRunning = true;
        game.lastTime = performance.now();
        clearInputHistory();

        console.log('🎮 Multiplayer mode started');
        requestAnimationFrame(multiplayerLoop);
    });

    gameClient.on('stateUpdate', (data) => {
        game.serverTick = data.tick;
        game.matchTime = data.time;
        game.scores = data.scores || game.scores;

        // Update all players
        for (const playerState of data.players) {
            if (playerState.id === game.clientId) {
                // Reconcile local player
                const serverState = {
                    x: playerState.x,
                    y: playerState.y,
                    angle: playerState.a,
                    health: playerState.h,
                    weapon: playerState.w,
                    state: playerState.s,
                    lastProcessedInput: data.lastInput
                };
                reconcile(game.localPlayer, serverState, game.map);
                game.localPlayer.health = serverState.health;
                game.localPlayer.state = serverState.state;
            } else {
                // Update remote player state buffer
                const player = game.players.get(playerState.id);
                if (player) {
                    addState(player, {
                        x: playerState.x,
                        y: playerState.y,
                        angle: playerState.a,
                        health: playerState.h,
                        weapon: playerState.w,
                        state: playerState.s
                    });
                }
            }
        }
    });

    gameClient.on('playerJoin', (data) => {
        console.log(`Player joined: ${data.username}`);
        const index = game.players.size;
        addPlayer(data.playerId, {
            ...data,
            color: PLAYER_COLORS[index % PLAYER_COLORS.length]
        });
    });

    gameClient.on('playerLeave', (data) => {
        console.log(`Player left: ${data.playerId}`);
        removePlayer(data.playerId);
    });

    gameClient.on('hit', (data) => {
        if (data.target === game.clientId) {
            // We got hit!
            game.damageFlash = { intensity: 0.3, time: 0.2 };
            playSound('hurt');
        }
    });

    gameClient.on('kill', (data) => {
        addKillToFeed(data.killer, data.killerName, data.victim, data.victimName, data.weapon);

        if (data.killer === game.clientId) {
            playSound('kill');
        }
        if (data.victim === game.clientId) {
            playSound('death');
        }
    });

    gameClient.on('respawn', (data) => {
        const player = game.players.get(data.playerId);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.angle = data.angle;
            player.health = 100;
            player.state = 'alive';

            if (data.playerId === game.clientId) {
                // Clear prediction state on respawn
                clearInputHistory();
            }
        }
    });

    gameClient.on('matchStart', (data) => {
        game.matchState = 'playing';
        game.matchDuration = data.duration;
        game.matchTime = data.duration;
        console.log('Match started!');
    });

    gameClient.on('matchEnd', (data) => {
        game.matchState = 'ended';
        console.log('Match ended! Winner:', data.winner);
        // Show results...
    });

    gameClient.on('disconnect', () => {
        console.log('Disconnected from server');
        gameMode = 'menu';
        showMenu();
    });

    gameClient.on('error', (error) => {
        console.error('Network error:', error);
    });
}

function multiplayerLoop(currentTime) {
    if (gameMode !== 'multiplayer' || !game.isRunning) return;

    updateDeltaTime(currentTime);
    updateFps(currentTime);

    const localPlayer = game.localPlayer;
    if (!localPlayer) {
        requestAnimationFrame(multiplayerLoop);
        return;
    }

    // Gather input
    const input = gatherInput();

    // UPDATE
    if (game.matchState === 'playing' && localPlayer.state === 'alive') {
        // Apply input locally (prediction)
        applyInput(localPlayer, input, game.deltaTime, game.map);

        // Record for reconciliation
        recordInput(input, localPlayer);

        // Send to server
        gameClient.sendInput(input);

        // Handle shooting
        if (input.shoot) {
            gameClient.sendShoot(localPlayer.angle, localPlayer.weapon);
        }
    }

    // Interpolate remote players
    for (const [playerId, player] of game.players) {
        if (playerId !== game.clientId && player.stateBuffer) {
            interpolate(player);
        }
    }

    // Update weapon animation
    updateWeapon(game.deltaTime);

    // RENDER
    renderGame(localPlayer);

    // Render multiplayer UI
    renderMultiplayerHud(game.ctx);

    // Network stats
    if (game.debug.showNetStats) {
        renderNetStats(game.ctx);
    }

    requestAnimationFrame(multiplayerLoop);
}

function gatherInput() {
    const keys = getKeys();
    const mouseDelta = consumeMouseDelta();
    const touch = getTouchControls();
    const touchInput = touch?.getInput() || {};

    return {
        forward: keys.forward || touchInput.forward,
        backward: keys.backward || touchInput.backward,
        left: keys.left || touchInput.left,
        right: keys.right || touchInput.right,
        angle: game.localPlayer?.angle || 0,
        lookDelta: mouseDelta + (touchInput.lookDelta || 0),
        shoot: touchInput.shoot, // Mouse shooting handled separately
        weapon: getCurrentWeapon().id
    };
}

// ============================================
// RENDERING
// ============================================

function renderGame(viewPlayer) {
    const ctx = game.ctx;
    const rays = castRays(viewPlayer, game.map);

    clearScreen(ctx);
    renderWorld(ctx, rays, game.map);

    // Sprites (enemies/players + loot)
    renderSprites(ctx, rays);

    // Minimap
    if (game.debug.showMinimap) {
        renderMinimap(ctx, game.map, viewPlayer, rays);
    }

    // Weapon
    renderWeapon(ctx);

    // Touch controls
    const touch = getTouchControls();
    if (touch) {
        touch.render(ctx);
    }

    // HUD
    renderHud(ctx, viewPlayer);

    // Damage flash
    if (game.damageFlash && game.damageFlash.time > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${game.damageFlash.intensity})`;
        ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
        game.damageFlash.time -= game.deltaTime;
    }

    // Pickup flash
    if (game.pickupFlash && game.pickupFlash.time > 0) {
        const alpha = game.pickupFlash.intensity * (game.pickupFlash.time / 0.2);
        ctx.fillStyle = game.pickupFlash.color.replace(')', `, ${alpha * 0.3})`).replace('rgb', 'rgba');
        ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
        game.pickupFlash.time -= game.deltaTime;
    }

    // Debug info
    updateDebugInfo(viewPlayer);
}

function renderMultiplayerHud(ctx) {
    // Match timer
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    const minutes = Math.floor(game.matchTime / 60);
    const seconds = Math.floor(game.matchTime % 60);
    ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, SCREEN.WIDTH / 2, 30);

    // Kill feed (top right)
    ctx.textAlign = 'right';
    ctx.font = '12px monospace';
    let feedY = 50;
    for (const kill of game.killFeed.slice(-5)) {
        const age = (Date.now() - kill.time) / 1000;
        if (age > 5) continue;

        const alpha = Math.max(0, 1 - age / 5);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(`${kill.killerName} → ${kill.victimName}`, SCREEN.WIDTH - 10, feedY);
        feedY += 15;
    }

    // Scoreboard (Tab to show)
    if (game.showScoreboard) {
        renderScoreboard(ctx);
    }

    ctx.textAlign = 'left';
}

function renderScoreboard(ctx) {
    const players = getAllPlayers().sort((a, b) => {
        const scoreA = game.scores[a.id]?.kills || 0;
        const scoreB = game.scores[b.id]?.kills || 0;
        return scoreB - scoreA;
    });

    // Background
    const width = 300;
    const height = 40 + players.length * 25;
    const x = (SCREEN.WIDTH - width) / 2;
    const y = 60;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Header
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Player', x + 10, y + 25);
    ctx.textAlign = 'right';
    ctx.fillText('K', x + 220, y + 25);
    ctx.fillText('D', x + 260, y + 25);

    // Players
    ctx.font = '12px monospace';
    players.forEach((player, index) => {
        const py = y + 45 + index * 25;
        const score = game.scores[player.id] || { kills: 0, deaths: 0 };
        const isLocal = player.id === game.clientId;

        ctx.fillStyle = isLocal ? '#0f0' : '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(player.username.substring(0, 15), x + 10, py);
        ctx.textAlign = 'right';
        ctx.fillText(score.kills.toString(), x + 220, py);
        ctx.fillText(score.deaths.toString(), x + 260, py);
    });

    ctx.textAlign = 'left';
}

function renderConnectingScreen() {
    const ctx = game.ctx;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Connecting...', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText('Finding a match', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 30);

    ctx.textAlign = 'left';
}

function renderLevelComplete(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);

    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${currentLevel} COMPLETE!`, SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2);

    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    ctx.fillText('Preparing next level...', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 40);

    ctx.textAlign = 'left';
}

function renderNetStats(ctx) {
    ctx.fillStyle = '#0f0';
    ctx.font = '10px monospace';
    ctx.fillText(`Ping: ${gameClient.ping}ms`, 10, SCREEN.HEIGHT - 30);
    ctx.fillText(`Tick: ${game.serverTick}`, 10, SCREEN.HEIGHT - 20);
    ctx.fillText(`Players: ${game.players.size}`, 10, SCREEN.HEIGHT - 10);
}

// ============================================
// DEBUG COMMANDS
// ============================================

function setupDebugCommands() {
    window.game = game;
    window.gameClient = gameClient;

    window.noclip = () => {
        game.debug.noclip = !game.debug.noclip;
        console.log(`Noclip: ${game.debug.noclip ? 'ON' : 'OFF'}`);
    };

    window.showRays = () => {
        game.debug.showRays = !game.debug.showRays;
        console.log(`Show rays: ${game.debug.showRays ? 'ON' : 'OFF'}`);
    };

    window.netStats = () => {
        game.debug.showNetStats = !game.debug.showNetStats;
        console.log(`Net stats: ${game.debug.showNetStats ? 'ON' : 'OFF'}`);
    };

    window.teleport = (x, y) => {
        const player = getLocalPlayer();
        if (player) {
            player.x = x;
            player.y = y;
            console.log(`Teleported to: ${x}, ${y}`);
        }
    };

    window.godmode = () => {
        game.debug.godmode = !game.debug.godmode;
        const player = getLocalPlayer();
        if (player) {
            player.health = game.debug.godmode ? 9999 : 100;
            player.maxHealth = player.health;
        }
        console.log(`Godmode: ${game.debug.godmode ? 'ON' : 'OFF'}`);
    };

    // Scoreboard toggle
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && gameMode === 'multiplayer') {
            e.preventDefault();
            game.showScoreboard = true;
        }
        if (e.key === 'Escape') {
            if (gameMode === 'multiplayer') {
                gameClient.disconnect();
            }
            gameMode = 'menu';
            showMenu();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Tab') {
            game.showScoreboard = false;
        }
    });
}

// ============================================
// START
// ============================================

window.addEventListener('DOMContentLoaded', init);
