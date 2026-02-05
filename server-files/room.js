// Room - Game room management
// Handles matchmaking, game state, and player synchronization

import { S2C, encodeMessage, NETWORK } from './protocol.js';
import { generateMap } from './mapGenerator.js';

// ============================================
// WEAPON DEFINITIONS
// ============================================

const WEAPONS = {
    pistol: {
        damage: 25,
        range: 20,
        fireRate: 0.4,
        spread: 0,
        pellets: 1,
        type: 'hitscan'
    },
    shotgun: {
        damage: 12,
        range: 10,
        fireRate: 0.8,
        spread: 0.15,
        pellets: 8,
        type: 'hitscan'
    },
    machinegun: {
        damage: 15,
        range: 18,
        fireRate: 0.1,
        spread: 0.03,
        pellets: 1,
        type: 'hitscan'
    },
    smg: {
        damage: 12,
        range: 15,
        fireRate: 0.08,
        spread: 0.05,
        pellets: 1,
        type: 'hitscan'
    },
    plasma: {
        damage: 35,
        range: 25,
        fireRate: 0.25,
        spread: 0,
        pellets: 1,
        speed: 15,
        type: 'projectile'
    },
    rocket: {
        damage: 80,
        range: 30,
        fireRate: 1.0,
        spread: 0,
        pellets: 1,
        speed: 8,
        splashRadius: 3,
        type: 'projectile'
    },
    railgun: {
        damage: 100,
        range: 50,
        fireRate: 1.5,
        spread: 0,
        pellets: 1,
        penetration: 3,
        type: 'hitscan'
    }
};

// ============================================
// GAME ROOM CLASS
// ============================================

export class GameRoom {
    constructor(id, maxPlayers) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        this.players = new Map(); // playerId → PlayerState

        // Game state
        this.state = 'waiting'; // waiting, countdown, playing, ended
        this.tick = 0;
        this.matchTime = 0;
        this.matchDuration = NETWORK.MATCH_DURATION;

        // Map - generate with seed for client sync
        this.mapSeed = Date.now();
        this.mapSize = 32;
        this.map = generateMap(this.mapSize, this.mapSize, this.mapSeed);
        this.spawnPoints = this.map.spawnPoints;

        // Projectiles (for rockets, plasma)
        this.projectiles = [];

        // Scores
        this.scores = {}; // playerId → { kills, deaths }

        // Game loop
        this.tickInterval = null;
        this.lastTickTime = 0;

        // Kill feed
        this.killFeed = [];

        console.log(`Room ${id} created with seed ${this.mapSeed}, ${this.spawnPoints.length} spawn points`);
    }

    // ============================================
    // PLAYER MANAGEMENT
    // ============================================

    addPlayer(playerId, playerInfo) {
        // Find spawn point
        const spawn = this._findSafeSpawn();

        const player = {
            id: playerId,
            fid: playerInfo.fid,
            username: playerInfo.username,
            displayName: playerInfo.displayName,
            ws: playerInfo.ws,

            // Position
            x: spawn.x,
            y: spawn.y,
            angle: Math.random() * Math.PI * 2,

            // State
            health: 100,
            maxHealth: 100,
            weapon: 'pistol',
            state: 'alive', // alive, dead, spectating

            // Respawn
            respawnTime: 0,

            // Input
            lastInput: null,
            lastProcessedInput: 0,

            // Stats
            kills: 0,
            deaths: 0
        };

        this.players.set(playerId, player);
        this.scores[playerId] = { kills: 0, deaths: 0 };

        return player;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        delete this.scores[playerId];
    }

    isEmpty() {
        return this.players.size === 0;
    }

    isFull() {
        return this.players.size >= this.maxPlayers;
    }

    getPlayersInfo() {
        return Array.from(this.players.values()).map(p => ({
            id: p.id,
            username: p.username,
            displayName: p.displayName,
            x: p.x,
            y: p.y,
            angle: p.angle,
            health: p.health,
            weapon: p.weapon,
            state: p.state
        }));
    }

    // ============================================
    // GAME STATE
    // ============================================

    checkStartConditions() {
        // Start when we have at least 2 players (or 1 for testing)
        if (this.state === 'waiting' && this.players.size >= 1) {
            this.startCountdown();
        }
    }

    startCountdown() {
        this.state = 'countdown';
        console.log(`Room ${this.id}: Starting countdown`);

        // Notify players
        this.broadcast(encodeMessage(S2C.MATCH_START, {
            countdown: 3,
            mapSeed: this.mapSeed
        }));

        // Start game after countdown
        setTimeout(() => {
            this.startGame();
        }, 3000);
    }

    startGame() {
        this.state = 'playing';
        this.tick = 0;
        this.matchTime = 0;
        this.lastTickTime = Date.now();

        console.log(`Room ${this.id}: Game started!`);

        // Reset all players
        for (const player of this.players.values()) {
            const spawn = this._findSafeSpawn();
            player.x = spawn.x;
            player.y = spawn.y;
            player.health = 100;
            player.state = 'alive';
            player.kills = 0;
            player.deaths = 0;
        }

        // Start game loop
        this.tickInterval = setInterval(() => {
            this.update();
        }, NETWORK.TICK_INTERVAL);
    }

    endGame() {
        this.state = 'ended';

        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }

        // Find winner
        let winner = null;
        let maxKills = -1;
        for (const [playerId, player] of this.players) {
            if (player.kills > maxKills) {
                maxKills = player.kills;
                winner = playerId;
            }
        }

        console.log(`Room ${this.id}: Game ended! Winner: ${winner}`);

        // Notify players
        this.broadcast(encodeMessage(S2C.MATCH_END, {
            winner,
            scores: this.scores,
            stats: this._getMatchStats()
        }));

        // Restart after delay
        setTimeout(() => {
            this.state = 'waiting';
            this.checkStartConditions();
        }, 10000);
    }

    // ============================================
    // GAME LOOP
    // ============================================

    update() {
        if (this.state !== 'playing') return;

        const now = Date.now();
        const deltaTime = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;

        this.tick++;
        this.matchTime += deltaTime;

        // Check match end
        if (this.matchTime >= this.matchDuration) {
            this.endGame();
            return;
        }

        // Update all players
        for (const player of this.players.values()) {
            this._updatePlayer(player, deltaTime);
        }

        // Update projectiles
        this._updateProjectiles(deltaTime);

        // Send state to all players
        this._broadcastState();
    }

    _updatePlayer(player, deltaTime) {
        // Handle respawn
        if (player.state === 'dead') {
            player.respawnTime -= deltaTime;
            if (player.respawnTime <= 0) {
                this._respawnPlayer(player);
            }
            return;
        }

        // Apply last input
        if (player.lastInput) {
            this._applyPlayerInput(player, player.lastInput, deltaTime);
        }
    }

    _applyPlayerInput(player, input, deltaTime) {
        const speed = 5.0 * deltaTime; // Movement speed

        // Rotation
        if (input.angle !== undefined) {
            player.angle = input.angle;
        }

        // Movement
        const cos = Math.cos(player.angle);
        const sin = Math.sin(player.angle);
        let moveX = 0;
        let moveY = 0;

        if (input.forward) { moveX += cos * speed; moveY += sin * speed; }
        if (input.backward) { moveX -= cos * speed; moveY -= sin * speed; }
        if (input.left) { moveX += sin * speed; moveY -= cos * speed; }
        if (input.right) { moveX -= sin * speed; moveY += cos * speed; }

        // Collision detection with sliding
        const PLAYER_RADIUS = 0.25;
        const newX = player.x + moveX;
        const newY = player.y + moveY;

        // Check X movement
        if (!this._checkCollision(newX, player.y, PLAYER_RADIUS)) {
            player.x = newX;
        }

        // Check Y movement
        if (!this._checkCollision(player.x, newY, PLAYER_RADIUS)) {
            player.y = newY;
        }

        player.lastProcessedInput = input.seq;
    }

    /**
     * Check collision with walls
     */
    _checkCollision(x, y, radius) {
        // Boundary check
        if (x < 1 || x >= this.mapSize - 1 || y < 1 || y >= this.mapSize - 1) {
            return true;
        }

        // Check 4 corners around player
        const offsets = [
            { x: -radius, y: -radius },
            { x: radius, y: -radius },
            { x: -radius, y: radius },
            { x: radius, y: radius }
        ];

        for (const offset of offsets) {
            if (this.map.isWall(x + offset.x, y + offset.y)) {
                return true;
            }
        }

        return false;
    }

    // ============================================
    // INPUT HANDLING
    // ============================================

    handlePlayerInput(playerId, input) {
        const player = this.players.get(playerId);
        if (!player || player.state !== 'alive') return;

        // Input validation (anti-cheat)
        if (!this._validateInput(player, input)) {
            return;
        }

        player.lastInput = input;
    }

    /**
     * Validate player input (basic anti-cheat)
     */
    _validateInput(player, input) {
        // Track input frequency
        player.inputCount = (player.inputCount || 0) + 1;

        // Reset counter every second
        const now = Date.now();
        if (!player.lastInputReset || now - player.lastInputReset > 1000) {
            player.inputCount = 1;
            player.lastInputReset = now;
        }

        // Max 100 inputs per second (way more than legit player would send)
        if (player.inputCount > 100) {
            console.warn(`Input flood from ${player.username}: ${player.inputCount} inputs/sec`);
            player.violations = (player.violations || 0) + 1;
            return false;
        }

        // Validate angle (should be number)
        if (input.angle !== undefined) {
            if (typeof input.angle !== 'number' || isNaN(input.angle)) {
                return false;
            }
        }

        // Validate sequence number (should increase)
        if (input.seq !== undefined) {
            if (player.lastValidSeq && input.seq <= player.lastValidSeq) {
                return false; // Out of order packet
            }
            player.lastValidSeq = input.seq;
        }

        return true;
    }

    handlePlayerShoot(playerId, angle, weapon) {
        const player = this.players.get(playerId);
        if (!player || player.state !== 'alive') return;

        // Fire rate validation
        const weaponData = WEAPONS[weapon] || WEAPONS.pistol;
        const now = Date.now();
        const timeSinceLastShot = now - (player.lastShotTime || 0);
        const minInterval = weaponData.fireRate * 1000 * 0.8; // 20% tolerance

        if (timeSinceLastShot < minInterval) {
            player.rapidFireCount = (player.rapidFireCount || 0) + 1;
            if (player.rapidFireCount > 10) {
                console.warn(`Rapid fire from ${player.username}`);
            }
            return;
        }

        player.lastShotTime = now;
        player.rapidFireCount = 0;

        // Perform hit detection
        const hit = this._performHitscan(player, angle, weapon);

        if (hit) {
            const target = this.players.get(hit.playerId);
            if (target && target.state === 'alive') {
                // Apply damage
                target.health -= hit.damage;

                // Notify hit
                this.broadcast(encodeMessage(S2C.HIT, {
                    shooter: playerId,
                    target: hit.playerId,
                    damage: hit.damage,
                    weapon
                }));

                // Check for kill
                if (target.health <= 0) {
                    this._handleKill(player, target, weapon);
                }
            }
        }
    }

    handleWeaponSwitch(playerId, weapon) {
        const player = this.players.get(playerId);
        if (!player) return;

        player.weapon = weapon;
    }

    // ============================================
    // COMBAT
    // ============================================

    _performHitscan(shooter, angle, weapon) {
        const weaponData = WEAPONS[weapon] || WEAPONS.pistol;

        // Handle projectile weapons separately
        if (weaponData.type === 'projectile') {
            this._spawnProjectile(shooter, angle, weapon);
            return null;
        }

        const hits = [];

        // Shotgun fires multiple pellets
        const pelletCount = weaponData.pellets || 1;

        for (let i = 0; i < pelletCount; i++) {
            // Add spread for each pellet
            let pelletAngle = angle;
            if (weaponData.spread > 0) {
                pelletAngle += (Math.random() - 0.5) * weaponData.spread * 2;
            }

            const hit = this._castRay(shooter, pelletAngle, weaponData);
            if (hit) {
                hits.push(hit);
            }
        }

        // Combine hits on same target
        if (hits.length === 0) return null;

        // For single pellet weapons, return single hit
        if (pelletCount === 1) {
            return hits[0];
        }

        // For shotgun, combine damage to same target
        const combinedHits = new Map();
        for (const hit of hits) {
            if (combinedHits.has(hit.playerId)) {
                combinedHits.get(hit.playerId).damage += hit.damage;
            } else {
                combinedHits.set(hit.playerId, { ...hit });
            }
        }

        // Return the highest damage target
        let bestHit = null;
        for (const hit of combinedHits.values()) {
            if (!bestHit || hit.damage > bestHit.damage) {
                bestHit = hit;
            }
        }

        return bestHit;
    }

    /**
     * Cast a single ray and check for hits
     */
    _castRay(shooter, angle, weaponData) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const range = weaponData.range;
        const penetration = weaponData.penetration || 0;

        // DDA raycasting for wall check
        const wallDist = this._raycastToWall(shooter.x, shooter.y, dirX, dirY, range);

        let closestHit = null;
        let closestDist = Math.min(range, wallDist);
        let penetrationCount = 0;

        // Check all players
        for (const [playerId, target] of this.players) {
            if (playerId === shooter.id || target.state !== 'alive') continue;

            // Vector to target
            const dx = target.x - shooter.x;
            const dy = target.y - shooter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > closestDist) continue;

            // Dot product (is target in front?)
            const dot = dx * dirX + dy * dirY;
            if (dot < 0) continue;

            // Perpendicular distance (how far from ray center)
            const perpDist = Math.abs(dx * dirY - dy * dirX);
            const hitRadius = 0.5;

            if (perpDist < hitRadius) {
                // Check if wall blocks the shot
                if (dot > wallDist) continue;

                if (penetration > penetrationCount) {
                    // Railgun: hit and continue through
                    penetrationCount++;
                    // TODO: Track all penetration hits
                }

                if (dot < closestDist || closestHit === null) {
                    closestDist = dot;
                    closestHit = { playerId, damage: weaponData.damage, distance: dot };
                }
            }
        }

        return closestHit;
    }

    /**
     * DDA raycast to find wall distance
     */
    _raycastToWall(startX, startY, dirX, dirY, maxDist) {
        const stepSize = 0.1;
        let x = startX;
        let y = startY;
        let dist = 0;

        while (dist < maxDist) {
            x += dirX * stepSize;
            y += dirY * stepSize;
            dist += stepSize;

            if (this.map.isWall(x, y)) {
                return dist;
            }
        }

        return maxDist;
    }

    /**
     * Spawn a projectile (rocket, plasma)
     */
    _spawnProjectile(shooter, angle, weapon) {
        const weaponData = WEAPONS[weapon];

        this.projectiles.push({
            id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ownerId: shooter.id,
            x: shooter.x,
            y: shooter.y,
            angle: angle,
            speed: weaponData.speed,
            damage: weaponData.damage,
            splashRadius: weaponData.splashRadius || 0,
            weapon: weapon,
            lifetime: 5 // seconds
        });

        // Notify clients
        this.broadcast(encodeMessage(S2C.HIT, {
            shooter: shooter.id,
            type: 'projectile',
            weapon,
            x: shooter.x,
            y: shooter.y,
            angle: angle
        }));
    }

    /**
     * Update all projectiles
     */
    _updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            // Move projectile
            proj.x += Math.cos(proj.angle) * proj.speed * deltaTime;
            proj.y += Math.sin(proj.angle) * proj.speed * deltaTime;
            proj.lifetime -= deltaTime;

            // Check wall collision
            if (this.map.isWall(proj.x, proj.y)) {
                this._explodeProjectile(proj, i);
                continue;
            }

            // Check player collision
            for (const [playerId, target] of this.players) {
                if (playerId === proj.ownerId || target.state !== 'alive') continue;

                const dx = target.x - proj.x;
                const dy = target.y - proj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.5) {
                    this._explodeProjectile(proj, i);
                    break;
                }
            }

            // Remove expired projectiles
            if (proj.lifetime <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    /**
     * Explode a projectile (splash damage)
     */
    _explodeProjectile(proj, index) {
        const shooter = this.players.get(proj.ownerId);

        if (proj.splashRadius > 0) {
            // Splash damage to all nearby players
            for (const [playerId, target] of this.players) {
                if (target.state !== 'alive') continue;

                const dx = target.x - proj.x;
                const dy = target.y - proj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < proj.splashRadius) {
                    // Damage falls off with distance
                    const falloff = 1 - (dist / proj.splashRadius);
                    const damage = Math.floor(proj.damage * falloff);

                    if (damage > 0) {
                        target.health -= damage;

                        this.broadcast(encodeMessage(S2C.HIT, {
                            shooter: proj.ownerId,
                            target: playerId,
                            damage: damage,
                            weapon: proj.weapon
                        }));

                        if (target.health <= 0 && shooter) {
                            this._handleKill(shooter, target, proj.weapon);
                        }
                    }
                }
            }
        } else {
            // Direct hit only (plasma)
            for (const [playerId, target] of this.players) {
                if (target.state !== 'alive') continue;

                const dx = target.x - proj.x;
                const dy = target.y - proj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.5) {
                    target.health -= proj.damage;

                    this.broadcast(encodeMessage(S2C.HIT, {
                        shooter: proj.ownerId,
                        target: playerId,
                        damage: proj.damage,
                        weapon: proj.weapon
                    }));

                    if (target.health <= 0 && shooter) {
                        this._handleKill(shooter, target, proj.weapon);
                    }
                    break;
                }
            }
        }

        // Notify explosion
        this.broadcast(encodeMessage(S2C.HIT, {
            type: 'explosion',
            x: proj.x,
            y: proj.y,
            radius: proj.splashRadius,
            weapon: proj.weapon
        }));

        // Remove projectile
        this.projectiles.splice(index, 1);
    }

    _handleKill(killer, victim, weapon) {
        victim.state = 'dead';
        victim.health = 0;
        victim.respawnTime = NETWORK.RESPAWN_TIME;
        victim.deaths++;

        killer.kills++;

        // Update scores
        this.scores[killer.id] = { kills: killer.kills, deaths: killer.deaths };
        this.scores[victim.id] = { kills: victim.kills, deaths: victim.deaths };

        // Kill feed
        this.killFeed.push({
            killer: killer.id,
            killerName: killer.username,
            victim: victim.id,
            victimName: victim.username,
            weapon,
            time: this.matchTime
        });

        // Keep last 5 kills
        if (this.killFeed.length > 5) {
            this.killFeed.shift();
        }

        console.log(`${killer.username} killed ${victim.username} with ${weapon}`);

        // Notify all players
        this.broadcast(encodeMessage(S2C.KILL, {
            killer: killer.id,
            killerName: killer.username,
            victim: victim.id,
            victimName: victim.username,
            weapon
        }));
    }

    _respawnPlayer(player) {
        const spawn = this._findSafeSpawn();
        player.x = spawn.x;
        player.y = spawn.y;
        player.angle = Math.random() * Math.PI * 2;
        player.health = 100;
        player.state = 'alive';
        player.respawnTime = 0;

        // Notify all players
        this.broadcast(encodeMessage(S2C.RESPAWN, {
            playerId: player.id,
            x: player.x,
            y: player.y,
            angle: player.angle
        }));
    }

    // ============================================
    // SPAWNING
    // ============================================

    _findSafeSpawn() {
        // Find spawn furthest from all players
        let bestSpawn = this.spawnPoints[0];
        let bestMinDist = 0;

        for (const spawn of this.spawnPoints) {
            // Verify spawn is valid (not in wall)
            if (this.map.isWall(spawn.x, spawn.y)) continue;

            let minDist = Infinity;

            for (const player of this.players.values()) {
                if (player.state !== 'alive') continue;

                const dx = spawn.x - player.x;
                const dy = spawn.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < minDist) {
                    minDist = dist;
                }
            }

            if (minDist > bestMinDist) {
                bestMinDist = minDist;
                bestSpawn = spawn;
            }
        }

        return bestSpawn;
    }

    // ============================================
    // BROADCAST
    // ============================================

    broadcast(message, excludeWs = null) {
        for (const player of this.players.values()) {
            if (player.ws && player.ws !== excludeWs && player.ws.readyState === 1) {
                player.ws.send(message);
            }
        }
    }

    _broadcastState() {
        const state = {
            tick: this.tick,
            time: Math.floor(this.matchDuration - this.matchTime),
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                x: Math.round(p.x * 100) / 100,
                y: Math.round(p.y * 100) / 100,
                a: Math.round(p.angle * 1000) / 1000,
                h: p.health,
                w: p.weapon,
                s: p.state
            })),
            projectiles: this.projectiles.map(p => ({
                id: p.id,
                x: Math.round(p.x * 100) / 100,
                y: Math.round(p.y * 100) / 100,
                a: Math.round(p.angle * 1000) / 1000,
                w: p.weapon
            })),
            scores: this.scores
        };

        // Send personalized state to each player (with their lastProcessedInput)
        for (const player of this.players.values()) {
            if (player.ws && player.ws.readyState === 1) {
                player.ws.send(encodeMessage(S2C.STATE, {
                    ...state,
                    lastInput: player.lastProcessedInput
                }));
            }
        }
    }

    _getMatchStats() {
        return {
            duration: this.matchTime,
            totalKills: this.killFeed.length,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                username: p.username,
                kills: p.kills,
                deaths: p.deaths,
                kd: p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills
            }))
        };
    }
}

// ============================================
// ROOM MANAGER CLASS
// ============================================

export class RoomManager {
    constructor(maxPlayersPerRoom) {
        this.rooms = new Map();
        this.maxPlayersPerRoom = maxPlayersPerRoom;
        this.roomIdCounter = 1;
    }

    findOrCreateRoom() {
        // Find room with space
        for (const room of this.rooms.values()) {
            if (!room.isFull() && room.state === 'waiting') {
                return room;
            }
        }

        // Create new room
        const roomId = `room_${this.roomIdCounter++}`;
        const room = new GameRoom(roomId, this.maxPlayersPerRoom);
        this.rooms.set(roomId, room);

        return room;
    }

    removeRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            if (room.tickInterval) {
                clearInterval(room.tickInterval);
            }
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} removed`);
        }
    }

    shutdown() {
        for (const room of this.rooms.values()) {
            if (room.tickInterval) {
                clearInterval(room.tickInterval);
            }
        }
        this.rooms.clear();
    }

    getRoomCount() {
        return this.rooms.size;
    }

    getStats() {
        const stats = {
            totalRooms: this.rooms.size,
            totalPlayers: 0,
            rooms: []
        };

        for (const room of this.rooms.values()) {
            stats.totalPlayers += room.players.size;
            stats.rooms.push({
                id: room.id,
                state: room.state,
                players: room.players.size,
                matchTime: Math.floor(room.matchTime)
            });
        }

        return stats;
    }
}
