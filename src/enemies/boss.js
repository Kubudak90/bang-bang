// Boss - Boss düşman sistemi
// Çoklu faz, özel saldırılar

import { game } from '../core/game.js';
import { getParticleSystem } from '../engine/particles.js';
import { addExplosionLight } from '../engine/lighting.js';
import { playSound } from '../core/audio.js';
import { spawnProjectile } from '../player/projectile.js';
import { hasLineOfSight } from './ai/pathfinder.js';

// Boss tipleri
export const BOSS_TYPES = {
    demon: {
        name: 'Demon Lord',
        health: 800,
        speed: 1.5,
        damage: 40,
        attackRange: 3,
        attackRate: 1.5,
        radius: 0.8,
        color: '#880000',
        phases: 3,
        points: 5000
    },
    mech: {
        name: 'War Machine',
        health: 1200,
        speed: 1.0,
        damage: 30,
        attackRange: 15,
        attackRate: 0.5,
        radius: 1.0,
        color: '#446688',
        phases: 3,
        points: 7500
    },
    shadow: {
        name: 'Shadow Master',
        health: 600,
        speed: 2.5,
        damage: 50,
        attackRange: 2,
        attackRate: 1.0,
        radius: 0.7,
        color: '#220033',
        phases: 3,
        points: 6000
    }
};

// Boss saldırı tipleri
const BOSS_ATTACKS = {
    // Demon saldırıları
    fireball: {
        damage: 30,
        speed: 8,
        splash: 2,
        cooldown: 2
    },
    firewave: {
        damage: 20,
        count: 8,  // 8 yönde
        cooldown: 5
    },
    summon: {
        type: 'grunt',
        count: 3,
        cooldown: 10
    },

    // Mech saldırıları
    machinegun: {
        damage: 10,
        count: 5,
        spread: 0.2,
        cooldown: 3
    },
    rocket: {
        damage: 50,
        speed: 6,
        splash: 3,
        cooldown: 4
    },
    laser: {
        damage: 80,
        chargeTime: 2,
        cooldown: 8
    },

    // Shadow saldırıları
    teleport: {
        cooldown: 5
    },
    shadowStrike: {
        damage: 60,
        cooldown: 3
    },
    clones: {
        count: 2,
        duration: 5,
        cooldown: 12
    }
};

/**
 * Boss oluştur
 */
export function createBoss(type, x, y) {
    const template = BOSS_TYPES[type];
    if (!template) {
        console.error(`Bilinmeyen boss tipi: ${type}`);
        return null;
    }

    const boss = {
        type,
        isBoss: true,
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

        // Boss özellikleri
        phase: 1,
        maxPhases: template.phases,
        phaseHealth: template.health / template.phases,

        // State
        isDead: false,
        isAlert: true,  // Boss her zaman alert
        state: 'idle',
        lastAttackTime: 0,

        // Cooldowns
        attackCooldowns: {},

        // Animasyon
        hurtFlash: 0,
        deathTimer: 0,
        phaseTransition: 0,

        // Boss'a özel state
        isCharging: false,
        chargeTarget: null,
        isTeleporting: false,

        /**
         * Hasar al
         */
        takeDamage(amount) {
            if (this.isDead || this.phaseTransition > 0) return;

            this.health -= amount;
            this.hurtFlash = 1;

            // Kan efekti
            const particles = getParticleSystem();
            if (particles) {
                particles.emitBurst(this.x, this.y, 'BLOOD_SPLATTER', 5);
            }

            // Faz kontrolü
            const newPhase = Math.ceil((this.maxHealth - this.health) / this.phaseHealth) + 1;
            if (newPhase > this.phase && newPhase <= this.maxPhases) {
                this.enterPhase(newPhase);
            }

            if (this.health <= 0) {
                this.die();
            }
        },

        /**
         * Yeni faza geç
         */
        enterPhase(newPhase) {
            this.phase = newPhase;
            this.phaseTransition = 2; // 2 saniye geçiş
            this.state = 'transition';

            // Faz geçiş efekti
            const particles = getParticleSystem();
            if (particles) {
                particles.emitBurst(this.x, this.y, 'EXPLOSION', 30);
            }
            addExplosionLight(this.x, this.y);
            playSound('explosion');

            console.log(`⚔️ ${template.name} Faz ${newPhase}!`);
        },

        /**
         * Öl
         */
        die() {
            this.isDead = true;
            this.state = 'dead';
            this.deathTimer = 3; // Uzun ölüm animasyonu
            game.score = (game.score || 0) + this.points;

            // Büyük patlama
            const particles = getParticleSystem();
            if (particles) {
                particles.emitBurst(this.x, this.y, 'EXPLOSION', 50);
                particles.emitBurst(this.x, this.y, 'DEBRIS', 30);
            }

            // Çoklu patlama ışıkları
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    addExplosionLight(
                        this.x + (Math.random() - 0.5) * 2,
                        this.y + (Math.random() - 0.5) * 2
                    );
                    playSound('explosion');
                }, i * 200);
            }

            console.log(`👑 ${template.name} YENİLDİ! +${this.points} puan`);
        }
    };

    return boss;
}

/**
 * Boss güncelle
 */
export function updateBoss(boss, player, map, deltaTime) {
    if (boss.isDead) {
        boss.deathTimer -= deltaTime;
        return boss.deathTimer > 0;
    }

    // Hurt flash
    boss.hurtFlash *= 0.9;

    // Faz geçişi
    if (boss.phaseTransition > 0) {
        boss.phaseTransition -= deltaTime;
        if (boss.phaseTransition <= 0) {
            boss.state = 'attack';
        }
        return true;
    }

    // Oyuncuya bak
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    boss.angle = Math.atan2(dy, dx);

    // Boss tipine göre AI
    switch (boss.type) {
        case 'demon':
            updateDemonBoss(boss, player, map, deltaTime);
            break;
        case 'mech':
            updateMechBoss(boss, player, map, deltaTime);
            break;
        case 'shadow':
            updateShadowBoss(boss, player, map, deltaTime);
            break;
    }

    return true;
}

/**
 * Demon Boss AI
 */
function updateDemonBoss(boss, player, map, deltaTime) {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Faza göre davranış
    switch (boss.phase) {
        case 1:
            // Basit: yaklaş ve saldır
            if (dist > boss.attackRange) {
                moveTowardsPlayer(boss, player, map, deltaTime);
            } else {
                tryBossAttack(boss, player, 'melee', deltaTime);
            }

            // Arada fireball at
            if (canUseAttack(boss, 'fireball')) {
                shootFireball(boss, player);
            }
            break;

        case 2:
            // Agresif: firewave + yakın saldırı
            if (canUseAttack(boss, 'firewave')) {
                shootFirewave(boss);
            } else if (dist > boss.attackRange) {
                moveTowardsPlayer(boss, player, map, deltaTime, 1.3); // Daha hızlı
            } else {
                tryBossAttack(boss, player, 'melee', deltaTime);
            }
            break;

        case 3:
            // Desperate: minion spawn + tüm saldırılar
            if (canUseAttack(boss, 'summon')) {
                summonMinions(boss, map);
            }
            if (canUseAttack(boss, 'firewave')) {
                shootFirewave(boss);
            } else if (canUseAttack(boss, 'fireball')) {
                shootFireball(boss, player);
            }

            if (dist > boss.attackRange) {
                moveTowardsPlayer(boss, player, map, deltaTime, 1.5);
            } else {
                tryBossAttack(boss, player, 'melee', deltaTime);
            }
            break;
    }
}

/**
 * Mech Boss AI
 */
function updateMechBoss(boss, player, map, deltaTime) {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Mech uzaktan savaşır
    if (dist < 5) {
        // Çok yakınsa geri çekil
        const dirX = -dx / dist;
        const dirY = -dy / dist;
        const moveX = dirX * boss.speed * deltaTime;
        const moveY = dirY * boss.speed * deltaTime;

        if (!map.isWall(Math.floor(boss.x + moveX), Math.floor(boss.y))) {
            boss.x += moveX;
        }
        if (!map.isWall(Math.floor(boss.x), Math.floor(boss.y + moveY))) {
            boss.y += moveY;
        }
    }

    // Faza göre saldırılar
    switch (boss.phase) {
        case 1:
            if (canUseAttack(boss, 'machinegun')) {
                shootMachinegun(boss, player);
            }
            break;

        case 2:
            if (canUseAttack(boss, 'rocket')) {
                shootRocket(boss, player);
            } else if (canUseAttack(boss, 'machinegun')) {
                shootMachinegun(boss, player);
            }
            break;

        case 3:
            // Laser charge
            if (canUseAttack(boss, 'laser') && hasLineOfSight(map, boss.x, boss.y, player.x, player.y)) {
                chargeLaser(boss, player);
            } else if (canUseAttack(boss, 'rocket')) {
                shootRocket(boss, player);
            } else if (canUseAttack(boss, 'machinegun')) {
                shootMachinegun(boss, player);
            }
            break;
    }
}

/**
 * Shadow Boss AI
 */
function updateShadowBoss(boss, player, map, deltaTime) {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Teleport hazırsa kullan
    if (boss.isTeleporting) {
        boss.teleportTimer -= deltaTime;
        if (boss.teleportTimer <= 0) {
            executeTeleport(boss, player, map);
        }
        return;
    }

    // Faza göre davranış
    switch (boss.phase) {
        case 1:
            // Hit and run
            if (dist > boss.attackRange * 2) {
                moveTowardsPlayer(boss, player, map, deltaTime, 1.5);
            } else if (dist <= boss.attackRange) {
                tryBossAttack(boss, player, 'melee', deltaTime);
                // Saldırdıktan sonra geri çekil
                if (Math.random() < 0.3) {
                    retreatFromPlayer(boss, player, map, deltaTime);
                }
            }
            break;

        case 2:
            // Teleport saldırıları
            if (canUseAttack(boss, 'teleport') && dist > 5) {
                startTeleport(boss, player);
            } else if (dist <= boss.attackRange) {
                tryBossAttack(boss, player, 'shadowStrike', deltaTime);
            } else {
                moveTowardsPlayer(boss, player, map, deltaTime, 2.0);
            }
            break;

        case 3:
            // Clone + teleport + aggressive
            if (canUseAttack(boss, 'clones')) {
                spawnClones(boss, map);
            }
            if (canUseAttack(boss, 'teleport')) {
                startTeleport(boss, player);
            } else if (dist <= boss.attackRange) {
                tryBossAttack(boss, player, 'shadowStrike', deltaTime);
            } else {
                moveTowardsPlayer(boss, player, map, deltaTime, 2.5);
            }
            break;
    }
}

// ============================================
// BOSS SALDIRI FONKSİYONLARI
// ============================================

function canUseAttack(boss, attackName) {
    const attack = BOSS_ATTACKS[attackName];
    if (!attack) return false;

    const now = performance.now() / 1000;
    const lastUse = boss.attackCooldowns[attackName] || 0;

    return (now - lastUse) >= attack.cooldown;
}

function useAttack(boss, attackName) {
    boss.attackCooldowns[attackName] = performance.now() / 1000;
}

function tryBossAttack(boss, player, type, deltaTime) {
    const now = performance.now() / 1000;
    if (now - boss.lastAttackTime < boss.attackRate) return;

    boss.lastAttackTime = now;

    // Hasar ver
    let damage = boss.damage;
    if (type === 'shadowStrike') {
        damage = BOSS_ATTACKS.shadowStrike.damage;
    }

    player.health -= damage;
    game.damageFlash = { time: 0.3, intensity: 0.7 };

    if (player.health <= 0) {
        player.health = 0;
        game.isGameOver = true;
    }
}

function shootFireball(boss, player) {
    useAttack(boss, 'fireball');

    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    spawnProjectile('rocket', boss.x, boss.y, angle, 'enemy');

    playSound('explosion');
}

function shootFirewave(boss) {
    useAttack(boss, 'firewave');

    // 8 yönde ateş
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        spawnProjectile('plasma', boss.x, boss.y, angle, 'enemy');
    }

    playSound('explosion');
}

function summonMinions(boss, map) {
    useAttack(boss, 'summon');

    const { spawnEnemy } = require('./enemy.js');

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const dist = 2;
        const x = boss.x + Math.cos(angle) * dist;
        const y = boss.y + Math.sin(angle) * dist;

        if (!map.isWall(Math.floor(x), Math.floor(y))) {
            spawnEnemy('grunt', x, y);
        }
    }

    console.log(`👹 ${boss.type} minion çağırdı!`);
}

function shootMachinegun(boss, player) {
    useAttack(boss, 'machinegun');

    const baseAngle = Math.atan2(player.y - boss.y, player.x - boss.x);

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const spread = (Math.random() - 0.5) * 0.2;
            const angle = baseAngle + spread;

            // Hitscan saldırı
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            // Oyuncuya çarpıyor mu kontrol
            const toPlayerX = player.x - boss.x;
            const toPlayerY = player.y - boss.y;
            const dot = toPlayerX * dx + toPlayerY * dy;
            const perpDist = Math.abs(toPlayerX * dy - toPlayerY * dx);

            if (perpDist < 0.5 && dot > 0 && dot < 20) {
                player.health -= 10;
                game.damageFlash = { time: 0.1, intensity: 0.3 };

                if (player.health <= 0) {
                    player.health = 0;
                    game.isGameOver = true;
                }
            }
        }, i * 100);
    }

    playSound('machinegun');
}

function shootRocket(boss, player) {
    useAttack(boss, 'rocket');

    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    spawnProjectile('rocket', boss.x, boss.y, angle, 'enemy');

    playSound('explosion');
}

function chargeLaser(boss, player) {
    useAttack(boss, 'laser');
    boss.isCharging = true;
    boss.chargeTarget = { x: player.x, y: player.y };

    // 2 saniye şarj
    setTimeout(() => {
        if (boss.isDead) return;

        boss.isCharging = false;

        // Lazer çiz (hitscan)
        const dx = boss.chargeTarget.x - boss.x;
        const dy = boss.chargeTarget.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Oyuncu hala oradaysa hasar ver
        const playerDist = Math.sqrt(
            (player.x - boss.chargeTarget.x) ** 2 +
            (player.y - boss.chargeTarget.y) ** 2
        );

        if (playerDist < 1.5) {
            player.health -= BOSS_ATTACKS.laser.damage;
            game.damageFlash = { time: 0.5, intensity: 1.0 };

            if (player.health <= 0) {
                player.health = 0;
                game.isGameOver = true;
            }
        }

        // Lazer efekti
        const particles = getParticleSystem();
        if (particles) {
            for (let i = 0; i < 20; i++) {
                const t = i / 20;
                particles.emit(
                    boss.x + dx * t,
                    boss.y + dy * t,
                    'SPARK'
                );
            }
        }

        playSound('explosion');
    }, 2000);
}

function startTeleport(boss, player) {
    useAttack(boss, 'teleport');
    boss.isTeleporting = true;
    boss.teleportTimer = 0.5;
    boss.teleportTarget = { x: player.x, y: player.y };

    // Kaybolma efekti
    const particles = getParticleSystem();
    if (particles) {
        particles.emitBurst(boss.x, boss.y, 'SMOKE', 10);
    }
}

function executeTeleport(boss, player, map) {
    boss.isTeleporting = false;

    // Oyuncunun arkasına ışınlan
    const angle = Math.atan2(player.y - boss.teleportTarget.y, player.x - boss.teleportTarget.x);
    const newX = player.x + Math.cos(angle + Math.PI) * 2;
    const newY = player.y + Math.sin(angle + Math.PI) * 2;

    if (!map.isWall(Math.floor(newX), Math.floor(newY))) {
        boss.x = newX;
        boss.y = newY;
    }

    // Belirme efekti
    const particles = getParticleSystem();
    if (particles) {
        particles.emitBurst(boss.x, boss.y, 'SMOKE', 10);
    }
}

function spawnClones(boss, map) {
    useAttack(boss, 'clones');

    // Clone'ları game.enemies'e ekle (düşük sağlık, aynı görünüm)
    const { createEnemy } = require('./enemy.js');

    for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 3;
        const x = boss.x + Math.cos(angle) * dist;
        const y = boss.y + Math.sin(angle) * dist;

        if (!map.isWall(Math.floor(x), Math.floor(y))) {
            const clone = createEnemy('ninja', x, y);
            if (clone) {
                clone.isClone = true;
                clone.health = 20;
                clone.maxHealth = 20;
                clone.color = boss.color;
                clone.cloneLifetime = 5;
                game.enemies.push(clone);
            }
        }
    }

    console.log(`👥 ${boss.type} klonlar oluşturdu!`);
}

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

function moveTowardsPlayer(boss, player, map, deltaTime, speedMult = 1) {
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    const moveX = dirX * boss.speed * speedMult * deltaTime;
    const moveY = dirY * boss.speed * speedMult * deltaTime;

    if (!map.isWall(Math.floor(boss.x + moveX), Math.floor(boss.y))) {
        boss.x += moveX;
    }
    if (!map.isWall(Math.floor(boss.x), Math.floor(boss.y + moveY))) {
        boss.y += moveY;
    }
}

function retreatFromPlayer(boss, player, map, deltaTime) {
    const dx = boss.x - player.x;
    const dy = boss.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    const moveX = dirX * boss.speed * 1.5 * deltaTime;
    const moveY = dirY * boss.speed * 1.5 * deltaTime;

    if (!map.isWall(Math.floor(boss.x + moveX), Math.floor(boss.y))) {
        boss.x += moveX;
    }
    if (!map.isWall(Math.floor(boss.x), Math.floor(boss.y + moveY))) {
        boss.y += moveY;
    }
}

/**
 * Boss spawn et
 */
export function spawnBoss(type, x, y) {
    const boss = createBoss(type, x, y);
    if (boss) {
        if (!game.enemies) game.enemies = [];
        game.enemies.push(boss);
        game.currentBoss = boss;
        console.log(`👑 BOSS: ${BOSS_TYPES[type].name} ortaya çıktı!`);
    }
    return boss;
}

/**
 * Aktif boss var mı?
 */
export function hasActiveBoss() {
    return game.currentBoss && !game.currentBoss.isDead;
}

/**
 * Boss sağlık yüzdesi
 */
export function getBossHealthPercent() {
    if (!game.currentBoss) return 0;
    return game.currentBoss.health / game.currentBoss.maxHealth;
}
