// Enemy - düşman sistemi

import { game } from '../core/game.js';

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
        points: 200
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

        // State
        isDead: false,
        isAlert: false,        // Oyuncuyu gördü mü
        lastAttackTime: 0,
        state: 'idle',         // idle, chase, attack, dead
        targetX: x,
        targetY: y,

        // Animasyon
        hurtFlash: 0,
        deathTimer: 0,

        /**
         * Hasar al
         */
        takeDamage(amount) {
            if (this.isDead) return;

            this.health -= amount;
            this.hurtFlash = 1;
            this.isAlert = true;
            this.state = 'chase';

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

    // Oyuncuya mesafe
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    // Oyuncuya bak
    enemy.angle = Math.atan2(dy, dx);

    // Görüş mesafesi kontrolü - sadece görüş hattı varsa
    if (distToPlayer < 10 && hasLineOfSight(enemy, player, map)) {
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
                // Oyuncuya doğru hareket
                moveTowardsPlayer(enemy, player, map, deltaTime);
            }
            break;

        case 'attack':
            if (distToPlayer > enemy.attackRange * 1.5) {
                enemy.state = 'chase';
            } else {
                // Saldır
                tryAttack(enemy, player, map, deltaTime);
            }
            break;
    }

    return true; // Düşman hala aktif
}

/**
 * Oyuncuya doğru hareket
 */
function moveTowardsPlayer(enemy, player, map, deltaTime) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) return;

    // Normalize et
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Hareket
    const moveX = dirX * enemy.speed * deltaTime;
    const moveY = dirY * enemy.speed * deltaTime;

    // Collision check
    const newX = enemy.x + moveX;
    const newY = enemy.y + moveY;

    // Basit grid collision
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

    // Ray marching ile duvar kontrolü
    const steps = Math.ceil(dist * 2);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const checkX = enemy.x + dx * t;
        const checkY = enemy.y + dy * t;

        if (map.isWall(Math.floor(checkX), Math.floor(checkY))) {
            return false; // Duvar var, göremez
        }
    }
    return true; // Görüş hattı açık
}

/**
 * Oyuncuya saldır
 */
function attackPlayer(enemy, player, map) {
    // Görüş hattı kontrolü - duvarın arkasından saldıramaz
    if (!hasLineOfSight(enemy, player, map)) {
        return;
    }

    // Oyuncuya hasar ver
    player.health -= enemy.damage;

    // Ekranda kırmızı flash
    game.damageFlash = 1;

    console.log(`💥 ${ENEMY_TYPES[enemy.type].name} saldırdı! -${enemy.damage} HP`);

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
