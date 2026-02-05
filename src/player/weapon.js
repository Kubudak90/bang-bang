// Weapon - silah sistemi
// Enhanced: View kick integration, projectile weapons

import { game } from '../core/game.js';
import { getKeys } from '../input/keyboard.js';
import { playSound } from '../core/audio.js';
import { emitMuzzleFlash, emitShell, emitSpark, getParticleSystem } from '../engine/particles.js';
import { addMuzzleFlash as addMuzzleLight } from '../engine/lighting.js';
import { SCREEN } from '../core/config.js';
import { applyViewKick } from './player.js';
import { spawnProjectile } from './projectile.js';
import { calculateDamage, getFireRateMultiplier, applyLifesteal } from './perk.js';

// Silah kategorileri
export const WEAPON_CATEGORY = {
    HITSCAN: 'hitscan',      // Anında isabet (pistol, shotgun, smg, machinegun)
    PROJECTILE: 'projectile' // Mermi fırlatma (rocket, plasma)
};

// Silah tanımları
export const WEAPONS = {
    pistol: {
        name: 'Pistol',
        category: WEAPON_CATEGORY.HITSCAN,
        damage: 25,
        fireRate: 0.4,
        spread: 0,
        ammo: Infinity,
        maxAmmo: Infinity,
        automatic: false,
        range: 20,
        color: '#ffcc00',
        kickPitch: 3.0,
        kickYaw: 0.5,
        kickRecovery: 1.0
    },
    shotgun: {
        name: 'Shotgun',
        category: WEAPON_CATEGORY.HITSCAN,
        damage: 15,
        fireRate: 0.8,
        spread: 0.15,
        pellets: 6,
        ammo: 20,
        maxAmmo: 50,
        automatic: false,
        range: 8,
        color: '#ff6600',
        kickPitch: 8.0,
        kickYaw: 2.0,
        kickRecovery: 0.7
    },
    smg: {
        name: 'SMG',
        category: WEAPON_CATEGORY.HITSCAN,
        damage: 12,
        fireRate: 0.07,
        spread: 0.08,
        ammo: 150,
        maxAmmo: 300,
        automatic: true,
        range: 12,
        color: '#ffaa00',
        kickPitch: 1.0,
        kickYaw: 0.8,
        kickRecovery: 1.5
    },
    machinegun: {
        name: 'Machine Gun',
        category: WEAPON_CATEGORY.HITSCAN,
        damage: 15,
        fireRate: 0.1,
        spread: 0.05,
        ammo: 100,
        maxAmmo: 200,
        automatic: true,
        range: 15,
        color: '#ff0000',
        kickPitch: 1.5,
        kickYaw: 1.0,
        kickRecovery: 1.2
    },
    rocket: {
        name: 'Rocket Launcher',
        category: WEAPON_CATEGORY.PROJECTILE,
        projectileType: 'rocket',
        fireRate: 1.2,
        ammo: 10,
        maxAmmo: 30,
        automatic: false,
        color: '#ff4400',
        kickPitch: 6.0,
        kickYaw: 1.0,
        kickRecovery: 0.8
    },
    plasma: {
        name: 'Plasma Rifle',
        category: WEAPON_CATEGORY.PROJECTILE,
        projectileType: 'plasma',
        fireRate: 0.15,
        ammo: 80,
        maxAmmo: 200,
        automatic: true,
        color: '#00ffff',
        kickPitch: 1.2,
        kickYaw: 0.5,
        kickRecovery: 1.3
    }
};

// Silah state'i
let currentWeapon = 'pistol';
let lastFireTime = 0;
let isFiring = false;
let isReloading = false;

// Silah animasyon state
let weaponBob = 0;
let weaponKick = 0;
let muzzleFlash = 0;

/**
 * Silah sistemini başlat
 */
export function initWeapons() {
    // Mouse click event
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Sol tık
            isFiring = true;
            tryFire();
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isFiring = false;
        }
    });

    // Silah değiştirme (1-6)
    document.addEventListener('keydown', (e) => {
        if (e.key === '1') switchWeapon('pistol');
        if (e.key === '2') switchWeapon('shotgun');
        if (e.key === '3') switchWeapon('smg');
        if (e.key === '4') switchWeapon('machinegun');
        if (e.key === '5') switchWeapon('rocket');
        if (e.key === '6') switchWeapon('plasma');
    });

    console.log('🔫 Silah sistemi başlatıldı');
}

/**
 * Silah değiştir
 */
function switchWeapon(weaponId) {
    if (WEAPONS[weaponId] && weaponId !== currentWeapon) {
        currentWeapon = weaponId;
        weaponKick = 0;
        console.log(`Silah: ${WEAPONS[weaponId].name}`);
    }
}

/**
 * Ateş etmeyi dene
 */
function tryFire() {
    const now = performance.now() / 1000;
    const weapon = WEAPONS[currentWeapon];
    const player = game.player;

    // Perk'li ateş hızı
    const fireRateMult = getFireRateMultiplier(player);
    const actualFireRate = weapon.fireRate * fireRateMult;

    if (now - lastFireTime < actualFireRate) return;
    if (weapon.ammo <= 0) return;
    if (isReloading) return;

    // Ateş!
    fire();
    lastFireTime = now;
}

/**
 * Ateş et
 */
function fire() {
    const weapon = WEAPONS[currentWeapon];
    const player = game.player;

    // Mermi azalt
    if (weapon.ammo !== Infinity) {
        weapon.ammo--;
    }

    // Animasyon
    weaponKick = 1;
    muzzleFlash = 1;

    // View kick uygula (kamera geri tepmesi)
    if (player && weapon.kickPitch) {
        const pitchKick = weapon.kickPitch;
        const yawKick = (Math.random() - 0.5) * weapon.kickYaw;
        applyViewKick(player, pitchKick, yawKick);
    }

    // Partikül efektleri
    // Muzzle flash - silah pozisyonunda
    const muzzleX = SCREEN.WIDTH / 2 + (Math.random() - 0.5) * 20;
    const muzzleY = SCREEN.HEIGHT - 80 + (Math.random() - 0.5) * 10;
    emitMuzzleFlash(muzzleX, muzzleY);

    // Muzzle flash ışık efekti (dünya koordinatlarında)
    if (player) {
        const lightX = player.x + Math.cos(player.angle) * 0.5;
        const lightY = player.y + Math.sin(player.angle) * 0.5;
        addMuzzleLight(lightX, lightY);
    }

    // Ses çal
    playSound(currentWeapon);

    // Silah kategorisine göre işlem
    if (weapon.category === WEAPON_CATEGORY.PROJECTILE) {
        // Projectile silahları - mermi fırlat
        if (player) {
            const spawnDist = 0.5; // Oyuncunun biraz önünde spawn
            const spawnX = player.x + Math.cos(player.angle) * spawnDist;
            const spawnY = player.y + Math.sin(player.angle) * spawnDist;
            spawnProjectile(weapon.projectileType, spawnX, spawnY, player.angle, 'player');
        }
    } else {
        // Hitscan silahları - anında isabet

        // Kovan fırlatma (shotgun ve rocket için değil)
        if (currentWeapon !== 'shotgun' && currentWeapon !== 'rocket') {
            const shellX = SCREEN.WIDTH / 2 + 40;
            const shellY = SCREEN.HEIGHT - 100;
            emitShell(shellX, shellY);
        }

        // Hit detection
        if (weapon.pellets) {
            // Shotgun - çoklu pellet
            for (let i = 0; i < weapon.pellets; i++) {
                const spreadAngle = (Math.random() - 0.5) * weapon.spread * 2;
                checkHit(spreadAngle, weapon.damage, weapon.range);
            }
        } else {
            // Tek mermi
            const spreadAngle = (Math.random() - 0.5) * (weapon.spread || 0) * 2;
            checkHit(spreadAngle, weapon.damage, weapon.range);
        }
    }
}

/**
 * Hit kontrolü - düşmana isabet ettik mi?
 */
function checkHit(spreadAngle, damage, range) {
    const player = game.player;
    const angle = player.angle + spreadAngle;

    // Ray cast ile düşman kontrolü
    const hit = castWeaponRay(player.x, player.y, angle, range);

    if (hit && hit.enemy) {
        // Perk'li hasar hesapla
        const actualDamage = calculateDamage(damage, player);

        // Düşmana hasar ver
        hit.enemy.takeDamage(actualDamage);

        // Lifesteal uygula
        applyLifesteal(player, actualDamage);
    }
}

/**
 * Silah için ray cast
 * Düşmanlara karşı kontrol
 */
function castWeaponRay(startX, startY, angle, maxDist) {
    const enemies = game.enemies || [];
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let closestHit = null;
    let closestDist = maxDist;

    for (const enemy of enemies) {
        if (enemy.isDead) continue;

        // Düşmana olan vektör
        const dx = enemy.x - startX;
        const dy = enemy.y - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) continue;

        // Ray üzerinde mi kontrol (dot product)
        const dot = dx * dirX + dy * dirY;
        if (dot < 0) continue; // Arkamızda

        // Ray'e perpendicular mesafe
        const perpDist = Math.abs(dx * dirY - dy * dirX);

        // Düşman yarıçapı içinde mi?
        if (perpDist < enemy.radius && dot < closestDist) {
            closestDist = dot;
            closestHit = { enemy, distance: dot };
        }
    }

    return closestHit;
}

/**
 * Silah güncelle (her frame)
 */
export function updateWeapon(deltaTime) {
    const weapon = WEAPONS[currentWeapon];

    // Otomatik silahlar için sürekli ateş
    if (isFiring && weapon.automatic) {
        tryFire();
    }

    // Animasyonları güncelle
    weaponKick *= 0.85; // Geri tepme azalması
    muzzleFlash *= 0.7;

    // Silah sallanması (yürürken)
    const keys = getKeys();
    const isMoving = keys.forward || keys.backward || keys.left || keys.right;
    if (isMoving) {
        weaponBob += deltaTime * 10;
    } else {
        weaponBob *= 0.9;
    }
}

/**
 * Mevcut silah bilgisi
 */
export function getCurrentWeapon() {
    return {
        ...WEAPONS[currentWeapon],
        id: currentWeapon,
        kick: weaponKick,
        bob: weaponBob,
        muzzleFlash: muzzleFlash
    };
}

/**
 * Mermi ekle
 */
export function addAmmo(weaponId, amount) {
    const weapon = WEAPONS[weaponId];
    if (weapon && weapon.ammo !== Infinity) {
        weapon.ammo = Math.min(weapon.ammo + amount, weapon.maxAmmo);
    }
}
