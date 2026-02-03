// Weapon - silah sistemi

import { game } from '../core/game.js';
import { getKeys } from '../input/keyboard.js';
import { SCREEN } from '../core/config.js';

// Silah tanımları
export const WEAPONS = {
    pistol: {
        name: 'Pistol',
        damage: 25,
        fireRate: 0.4,      // saniye başına atış aralığı
        spread: 0,          // isabet sapması (radyan)
        ammo: Infinity,     // sınırsız
        maxAmmo: Infinity,
        automatic: false,   // tek tek ateş
        range: 20,
        color: '#ffcc00'
    },
    shotgun: {
        name: 'Shotgun',
        damage: 15,         // pellet başına
        fireRate: 0.8,
        spread: 0.15,       // geniş yayılım
        pellets: 6,         // pellet sayısı
        ammo: 20,
        maxAmmo: 50,
        automatic: false,
        range: 8,
        color: '#ff6600'
    },
    machinegun: {
        name: 'Machine Gun',
        damage: 15,
        fireRate: 0.1,      // hızlı ateş
        spread: 0.05,
        ammo: 100,
        maxAmmo: 200,
        automatic: true,    // basılı tutunca ateş
        range: 15,
        color: '#ff0000'
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

// Ateş callback (efektler için)
let onFireCallback = null;

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

    // Silah değiştirme (1-2-3)
    document.addEventListener('keydown', (e) => {
        if (e.key === '1') switchWeapon('pistol');
        if (e.key === '2') switchWeapon('shotgun');
        if (e.key === '3') switchWeapon('machinegun');
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

    if (now - lastFireTime < weapon.fireRate) return;
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

    // Mermi azalt
    if (weapon.ammo !== Infinity) {
        weapon.ammo--;
    }

    // Animasyon
    weaponKick = 1;
    muzzleFlash = 1;

    // Hit detection
    let hitEnemy = null;
    if (weapon.pellets) {
        // Shotgun - çoklu pellet
        for (let i = 0; i < weapon.pellets; i++) {
            const spreadAngle = (Math.random() - 0.5) * weapon.spread * 2;
            const hit = checkHit(spreadAngle, weapon.damage, weapon.range);
            if (hit) hitEnemy = hit;
        }
    } else {
        // Tek mermi
        const spreadAngle = (Math.random() - 0.5) * weapon.spread * 2;
        hitEnemy = checkHit(spreadAngle, weapon.damage, weapon.range);
    }

    // Ateş callback'i çağır (efektler için)
    if (onFireCallback) {
        onFireCallback({
            weapon: currentWeapon,
            player: game.player,
            hit: hitEnemy
        });
    }
}

/**
 * Hit kontrolü - düşmana isabet ettik mi?
 * @returns {Object|null} Hit bilgisi veya null
 */
function checkHit(spreadAngle, damage, range) {
    const player = game.player;
    const angle = player.angle + spreadAngle;

    // Ray cast ile düşman kontrolü
    const hit = castWeaponRay(player.x, player.y, angle, range);

    if (hit && hit.enemy) {
        // Düşmana hasar ver
        const killed = hit.enemy.takeDamage(damage);
        return {
            enemy: hit.enemy,
            distance: hit.distance,
            killed: killed,
            x: hit.enemy.x,
            y: hit.enemy.y
        };
    }

    return null;
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

/**
 * Ateş callback'i ayarla
 * Parçacık efektleri için main.js'den çağrılır
 */
export function setOnFireCallback(callback) {
    onFireCallback = callback;
}

/**
 * Ekran pozisyonu al (kovan atma için)
 */
export function getWeaponScreenPosition() {
    const weapon = WEAPONS[currentWeapon];
    const baseX = SCREEN.WIDTH / 2;
    const baseY = SCREEN.HEIGHT - 20;

    const bobX = Math.sin(weaponBob) * 5;
    const bobY = Math.abs(Math.cos(weaponBob * 2)) * 3;
    const kickY = weaponKick * 30;

    return {
        x: baseX + bobX + 30, // Kovan sağdan atılır
        y: baseY + bobY + kickY - 60
    };
}
