// Enemy - düşman sistemi
// Enhanced: Behavior tree AI + yeni düşman tipleri

import { game } from '../core/game.js';
import { emitBlood, emitExplosion, getParticleSystem } from '../engine/particles.js';
import { playSound } from '../core/audio.js';
import { executeBehavior } from './ai/behaviors.js';
import { calculateDamageTaken } from '../player/perk.js';

// AI modu: true = behavior tree, false = eski basit AI
let useBehaviorTree = true;

// Düşman tipleri
export const ENEMY_TYPES = {
    grunt: {
        name: 'Grunt',
        health: 50,
        speed: 1.5,
        damage: 10,
        attackRange: 1.5,    // yakın dövüş
        attackRate: 1.0,     // saniye
        radius: 0.4,
        color: '#aa0000',
        viewRange: 10,
        points: 100
    },
    shooter: {
        name: 'Shooter',
        health: 30,
        speed: 0.8,
        damage: 15,
        attackRange: 10,     // uzaktan ateş
        attackRate: 1.5,
        radius: 0.35,
        color: '#00aa00',
        viewRange: 12,
        points: 150
    },
    charger: {
        name: 'Charger',
        health: 80,
        speed: 3.0,          // hızlı
        damage: 25,
        attackRange: 1.2,
        attackRate: 2.0,
        radius: 0.5,
        color: '#aa00aa',
        viewRange: 8,
        points: 200
    },
    // === YENİ DÜŞMAN TİPLERİ ===
    sniper: {
        name: 'Sniper',
        health: 40,
        speed: 0.6,
        damage: 45,          // yüksek hasar
        attackRange: 20,     // çok uzak menzil
        attackRate: 2.5,     // yavaş ateş
        radius: 0.35,
        color: '#666600',
        viewRange: 25,       // geniş görüş
        points: 250
    },
    tank: {
        name: 'Tank',
        health: 200,         // çok dayanıklı
        speed: 0.8,
        damage: 35,
        attackRange: 2.0,
        attackRate: 1.5,
        radius: 0.55,
        color: '#444488',
        viewRange: 8,
        armor: 0.4,          // %40 hasar azaltma
        points: 300
    },
    ninja: {
        name: 'Ninja',
        health: 45,
        speed: 3.5,          // çok hızlı
        damage: 30,
        attackRange: 1.2,
        attackRate: 0.8,     // hızlı saldırı
        radius: 0.35,
        color: '#333333',
        viewRange: 12,
        cloakDuration: 4,    // 4 saniye görünmezlik
        cloakCooldown: 10,   // 10 saniye bekleme
        points: 350
    }
};

/**
 * Düşman oluştur
 */
export function createEnemy(type, x, y) {
    const template = ENEMY_TYPES[type];
    if (!template) {
        console.error(`Bilinmeyen düşman tipi: ${type}`);
        return null;
    }

    return {
        type,
        x,
        y,
        angle: 0,
        health: template.health,
        maxHealth: template.health,
        speed: template.speed,
        damage: template.damage,
        attackRange: template.attackRange,
        attackRate: template.attackRate,
        radius: template.radius,
        color: template.color,
        points: template.points,
        viewRange: template.viewRange || 10,
        armor: template.armor || 0,

        // Ninja özellikleri
        cloakDuration: template.cloakDuration,
        cloakCooldown: template.cloakCooldown,
        isCloaked: false,
        lastCloakTime: 0,

        // State
        isDead: false,
        isAlert: false,        // Oyuncuyu gördü mü
        lastAttackTime: 0,
        state: 'idle',         // idle, chase, attack, dead
        targetX: x,
        targetY: y,

        // Pathfinding
        path: null,
        pathIndex: 0,
        pathRecalcTime: 0,

        // Patrol
        patrolTarget: null,
        patrolReached: false,

        // Behavior tree
        behaviorTree: null,

        // Animasyon
        hurtFlash: 0,
        deathTimer: 0,

        /**
         * Hasar al
         */
        takeDamage(amount) {
            if (this.isDead) return;

            // Zırh kontrolü
            let actualDamage = amount;
            if (this.armor > 0) {
                actualDamage = Math.floor(amount * (1 - this.armor));
            }

            this.health -= actualDamage;
            this.hurtFlash = 1;
            this.isAlert = true;
            this.state = 'chase';

            // Ninja görünmezliği saldırıda bozulsun
            if (this.isCloaked) {
                this.isCloaked = false;
            }

            // Kan efekti - hasar yönünde
            const player = game.player;
            if (player) {
                const angleFromPlayer = Math.atan2(this.y - player.y, this.x - player.x);
                emitBlood(this.x, this.y, angleFromPlayer);
            }

            if (this.health <= 0) {
                this.die();
            }
        },

        /**
         * Öl
         */
        die() {
            this.isDead = true;
            this.state = 'dead';
            this.deathTimer = 1;
            game.score = (game.score || 0) + this.points;

            // Büyük kan sıçraması
            const particles = getParticleSystem();
            if (particles) {
                particles.emitBurst(this.x, this.y, 'BLOOD_SPLATTER', 15);
            }

            // Ölüm sesi
            playSound('kill');

            console.log(`💀 ${template.name} öldü! +${this.points} puan`);
        }
    };
}

/**
 * Düşman güncelle
 */
export function updateEnemy(enemy, player, map, deltaTime) {
    if (enemy.isDead) {
        // Ölüm animasyonu
        enemy.deathTimer -= deltaTime * 2;
        return enemy.deathTimer > 0; // false olunca listeden kaldır
    }

    // Hurt flash azalt
    enemy.hurtFlash *= 0.9;

    // Behavior tree veya eski AI
    if (useBehaviorTree) {
        const context = {
            player,
            map,
            deltaTime,
            game
        };
        executeBehavior(enemy, context);
    } else {
        // Eski basit AI (fallback)
        updateEnemyLegacy(enemy, player, map, deltaTime);
    }

    return true; // Düşman hala aktif
}

/**
 * Eski AI sistemi (fallback)
 */
function updateEnemyLegacy(enemy, player, map, deltaTime) {
    // Oyuncuya mesafe
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    // Oyuncuya bak
    enemy.angle = Math.atan2(dy, dx);

    // Görüş mesafesi kontrolü
    if (distToPlayer < enemy.viewRange && hasLineOfSight(enemy, player, map)) {
        enemy.isAlert = true;
    }

    // State machine
    switch (enemy.state) {
        case 'idle':
            if (enemy.isAlert) {
                enemy.state = 'chase';
            }
            break;

        case 'chase':
            if (distToPlayer <= enemy.attackRange) {
                enemy.state = 'attack';
            } else {
                moveTowardsPlayer(enemy, player, map, deltaTime);
            }
            break;

        case 'attack':
            if (distToPlayer > enemy.attackRange * 1.5) {
                enemy.state = 'chase';
            } else {
                tryAttack(enemy, player, map, deltaTime);
            }
            break;
    }
}

/**
 * Oyuncuya doğru hareket
 */
function moveTowardsPlayer(enemy, player, map, deltaTime) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    const moveX = dirX * enemy.speed * deltaTime;
    const moveY = dirY * enemy.speed * deltaTime;

    const newX = enemy.x + moveX;
    const newY = enemy.y + moveY;

    if (!map.isWall(Math.floor(newX), Math.floor(enemy.y))) {
        enemy.x = newX;
    }
    if (!map.isWall(Math.floor(enemy.x), Math.floor(newY))) {
        enemy.y = newY;
    }
}

/**
 * Saldırı dene
 */
function tryAttack(enemy, player, map, deltaTime) {
    const now = performance.now() / 1000;

    if (now - enemy.lastAttackTime >= enemy.attackRate) {
        enemy.lastAttackTime = now;
        attackPlayer(enemy, player, map);
    }
}

/**
 * Görüş hattı kontrolü (duvar var mı?)
 */
function hasLineOfSight(enemy, player, map) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const steps = Math.ceil(dist * 2);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const checkX = enemy.x + dx * t;
        const checkY = enemy.y + dy * t;

        if (map.isWall(Math.floor(checkX), Math.floor(checkY))) {
            return false;
        }
    }
    return true;
}

/**
 * Oyuncuya saldır
 */
function attackPlayer(enemy, player, map) {
    if (!hasLineOfSight(enemy, player, map)) {
        return;
    }

    // Perk'li hasar hesapla
    const damage = calculateDamageTaken(enemy.damage, player);
    player.health -= damage;

    game.damageFlash = { time: 0.3, intensity: 0.5 };

    console.log(`💥 ${ENEMY_TYPES[enemy.type].name} saldırdı! -${damage} HP`);

    if (player.health <= 0) {
        player.health = 0;
        game.isGameOver = true;
        console.log('☠️ GAME OVER!');
    }
}

/**
 * Düşman spawn et
 */
export function spawnEnemy(type, x, y) {
    const enemy = createEnemy(type, x, y);
    if (enemy) {
        if (!game.enemies) game.enemies = [];
        game.enemies.push(enemy);
        console.log(`👹 ${ENEMY_TYPES[type].name} spawn oldu: ${x.toFixed(1)}, ${y.toFixed(1)}`);
    }
    return enemy;
}

/**
 * Tüm düşmanları güncelle
 */
export function updateAllEnemies(player, map, deltaTime) {
    if (!game.enemies) return;

    game.enemies = game.enemies.filter(enemy =>
        updateEnemy(enemy, player, map, deltaTime)
    );
}

/**
 * AI modunu değiştir (debug)
 */
export function toggleAIMode() {
    useBehaviorTree = !useBehaviorTree;
    console.log(`AI Mode: ${useBehaviorTree ? 'Behavior Tree' : 'Legacy'}`);
    return useBehaviorTree;
}

/**
 * Düşmanın görünürlük durumu (ninja cloak için)
 */
export function getEnemyVisibility(enemy) {
    if (enemy.isCloaked) {
        return 0.15; // %15 görünür
    }
    return 1.0;
}
