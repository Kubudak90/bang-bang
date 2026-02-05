// Projectile - mermi sistemi (roket, plazma vb.)
// Splash damage ve particle efektleri

import { game } from '../core/game.js';
import { SCREEN, RAYCASTER } from '../core/config.js';
import { getParticleSystem } from '../engine/particles.js';
import { addExplosionLight } from '../engine/lighting.js';
import { playSound } from '../core/audio.js';
import { getSplashRadiusMultiplier, calculateDamage, applyLifesteal } from './perk.js';

// Mermi tipleri
export const PROJECTILE_TYPES = {
    rocket: {
        name: 'Rocket',
        speed: 8,           // birim/saniye
        damage: 80,         // direkt hasar
        splashDamage: 50,   // splash hasar
        splashRadius: 3,    // splash yarıçapı
        lifetime: 5,        // saniye
        size: 0.15,         // görsel boyut
        color: '#ff4400',
        trailColor: '#ff8800',
        gravity: 0,         // yerçekimi etkisi
        explosive: true
    },
    plasma: {
        name: 'Plasma',
        speed: 15,
        damage: 35,
        splashDamage: 15,
        splashRadius: 1.5,
        lifetime: 3,
        size: 0.1,
        color: '#00ffff',
        trailColor: '#00aaff',
        gravity: 0,
        explosive: true
    },
    grenade: {
        name: 'Grenade',
        speed: 6,
        damage: 100,
        splashDamage: 60,
        splashRadius: 4,
        lifetime: 3,
        size: 0.12,
        color: '#448844',
        trailColor: '#666666',
        gravity: 5,         // aşağı düşer
        explosive: true,
        bounces: 2          // kaç kez zıplar
    }
};

// Aktif mermiler
let projectiles = [];

/**
 * Projectile sistemi güncelle
 */
export function updateProjectiles(map, deltaTime) {
    const toRemove = [];

    for (let i = 0; i < projectiles.length; i++) {
        const proj = projectiles[i];
        const type = PROJECTILE_TYPES[proj.type];

        // Ömür kontrolü
        proj.elapsed += deltaTime;
        if (proj.elapsed >= type.lifetime) {
            if (type.explosive) {
                explode(proj);
            }
            toRemove.push(i);
            continue;
        }

        // Yerçekimi uygula
        if (type.gravity) {
            proj.velY += type.gravity * deltaTime;
        }

        // Hareket
        const moveX = proj.velX * deltaTime;
        const moveY = proj.velY * deltaTime;
        const newX = proj.x + moveX;
        const newY = proj.y + moveY;

        // Duvar collision
        if (map.isWall(Math.floor(newX), Math.floor(newY))) {
            if (type.bounces && proj.bounceCount < type.bounces) {
                // Zıpla
                proj.bounceCount++;

                // Basit yansıma
                if (map.isWall(Math.floor(newX), Math.floor(proj.y))) {
                    proj.velX *= -0.6;
                }
                if (map.isWall(Math.floor(proj.x), Math.floor(newY))) {
                    proj.velY *= -0.6;
                }
            } else {
                // Patlat
                if (type.explosive) {
                    explode(proj);
                }
                toRemove.push(i);
                continue;
            }
        } else {
            proj.x = newX;
            proj.y = newY;
        }

        // Düşman collision
        const hit = checkProjectileHit(proj, type);
        if (hit) {
            // Direkt hasar (perk'li)
            let directDamage = type.damage;
            if (proj.owner === 'player' && game.player) {
                directDamage = calculateDamage(type.damage, game.player);
                applyLifesteal(game.player, directDamage);
            }
            hit.takeDamage(directDamage);

            // Patlat (splash damage)
            if (type.explosive) {
                explode(proj);
            }
            toRemove.push(i);
            continue;
        }

        // Trail partikül
        emitProjectileTrail(proj, type);
    }

    // Ölü mermileri kaldır (tersten)
    for (let i = toRemove.length - 1; i >= 0; i--) {
        projectiles.splice(toRemove[i], 1);
    }
}

/**
 * Mermi patlat
 */
function explode(proj) {
    const type = PROJECTILE_TYPES[proj.type];
    const player = game.player;

    // Perk çarpanları (sadece oyuncunun mermileri için)
    let splashDamage = type.splashDamage;
    let splashRadius = type.splashRadius;

    if (proj.owner === 'player' && player) {
        splashDamage = calculateDamage(type.splashDamage, player);
        splashRadius = type.splashRadius * getSplashRadiusMultiplier(player);
    }

    // Splash damage
    applySplashDamage(proj.x, proj.y, splashDamage, splashRadius, proj.owner);

    // Patlama efektleri
    const particles = getParticleSystem();
    if (particles) {
        particles.emitBurst(proj.x, proj.y, 'EXPLOSION', 20);
        particles.emitBurst(proj.x, proj.y, 'SMOKE', 10);
        particles.emitBurst(proj.x, proj.y, 'DEBRIS', 8);
    }

    // Patlama ışığı
    addExplosionLight(proj.x, proj.y);

    // Ses
    playSound('explosion');
}

/**
 * Splash damage uygula
 */
function applySplashDamage(x, y, damage, radius, owner = 'player') {
    const enemies = game.enemies || [];
    const player = game.player;
    let totalDamageDealt = 0;

    // Düşmanlara hasar
    for (const enemy of enemies) {
        if (enemy.isDead) continue;

        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
            // Mesafeye göre azalan hasar
            const falloff = 1 - (dist / radius);
            const actualDamage = Math.floor(damage * falloff);
            enemy.takeDamage(actualDamage);
            totalDamageDealt += actualDamage;
        }
    }

    // Lifesteal uygula (oyuncu mermileri için)
    if (owner === 'player' && player && totalDamageDealt > 0) {
        applyLifesteal(player, totalDamageDealt);
    }

    // Oyuncuya da splash damage (self-damage)
    if (player) {
        const dx = player.x - x;
        const dy = player.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < radius) {
            const falloff = 1 - (dist / radius);
            const actualDamage = Math.floor(damage * falloff * 0.5); // Kendine yarı hasar
            player.health -= actualDamage;
            game.damageFlash = { time: 0.3, intensity: 0.5 };

            if (player.health <= 0) {
                player.health = 0;
                game.isGameOver = true;
            }
        }
    }
}

/**
 * Mermi düşmana çarptı mı kontrol
 */
function checkProjectileHit(proj, type) {
    const enemies = game.enemies || [];

    for (const enemy of enemies) {
        if (enemy.isDead) continue;

        const dx = enemy.x - proj.x;
        const dy = enemy.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Çarpışma kontrolü (basit daire)
        if (dist < enemy.radius + type.size) {
            return enemy;
        }
    }

    return null;
}

/**
 * Trail partikül emit
 */
function emitProjectileTrail(proj, type) {
    const particles = getParticleSystem();
    if (!particles) return;

    // Her frame trail emit etme (performans)
    if (Math.random() > 0.3) return;

    // Trail tipine göre
    if (proj.type === 'rocket') {
        particles.emit(proj.x, proj.y, 'SMOKE');
    } else if (proj.type === 'plasma') {
        particles.emit(proj.x, proj.y, 'SPARK');
    }
}

/**
 * Yeni mermi oluştur
 */
export function spawnProjectile(type, x, y, angle, owner = 'player') {
    const template = PROJECTILE_TYPES[type];
    if (!template) {
        console.error(`Bilinmeyen mermi tipi: ${type}`);
        return null;
    }

    const proj = {
        type,
        x,
        y,
        velX: Math.cos(angle) * template.speed,
        velY: Math.sin(angle) * template.speed,
        angle,
        owner,
        elapsed: 0,
        bounceCount: 0
    };

    projectiles.push(proj);
    return proj;
}

/**
 * Mermileri render et (world space)
 */
export function renderProjectiles(ctx, viewPlayer) {
    const playerX = viewPlayer.x;
    const playerY = viewPlayer.y;
    const playerAngle = viewPlayer.angle;

    for (const proj of projectiles) {
        const type = PROJECTILE_TYPES[proj.type];

        // Oyuncuya göre pozisyon
        const dx = proj.x - playerX;
        const dy = proj.y - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > RAYCASTER.MAX_DEPTH) continue;

        // Açı hesapla
        const angleToProj = Math.atan2(dy, dx);
        let angleDiff = angleToProj - playerAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // FOV dışındaysa atla
        if (Math.abs(angleDiff) > RAYCASTER.FOV / 2 + 0.2) continue;

        // Ekran pozisyonu
        const screenX = SCREEN.WIDTH / 2 + (angleDiff / RAYCASTER.FOV) * SCREEN.WIDTH;
        const screenY = SCREEN.HEIGHT / 2;

        // Boyut (mesafeye göre)
        const size = (type.size / dist) * SCREEN.HEIGHT * 2;

        // Mesafe bazlı parlaklık
        const brightness = Math.max(0.3, 1 - dist / RAYCASTER.MAX_DEPTH);

        // Mermi çiz (basit daire)
        const r = parseInt(type.color.slice(1, 3), 16);
        const g = parseInt(type.color.slice(3, 5), 16);
        const b = parseInt(type.color.slice(5, 7), 16);

        ctx.fillStyle = `rgb(${Math.floor(r * brightness)},${Math.floor(g * brightness)},${Math.floor(b * brightness)})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(2, size), 0, Math.PI * 2);
        ctx.fill();

        // Glow efekti
        ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(4, size * 2), 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Tüm mermileri temizle
 */
export function clearProjectiles() {
    projectiles = [];
}

/**
 * Aktif mermi sayısı
 */
export function getProjectileCount() {
    return projectiles.length;
}
