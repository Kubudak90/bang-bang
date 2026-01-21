// Loot - toplanabilir eşyalar

import { game } from '../core/game.js';
import { addAmmo, WEAPONS } from '../player/weapon.js';

// Loot tipleri
export const LOOT_TYPES = {
    health_small: {
        name: 'Small Medkit',
        type: 'health',
        value: 25,
        color: '#00ff00',
        radius: 0.3
    },
    health_large: {
        name: 'Large Medkit',
        type: 'health',
        value: 50,
        color: '#00ff88',
        radius: 0.4
    },
    ammo_shotgun: {
        name: 'Shotgun Shells',
        type: 'ammo',
        weapon: 'shotgun',
        value: 8,
        color: '#ff6600',
        radius: 0.25
    },
    ammo_machinegun: {
        name: 'MG Ammo',
        type: 'ammo',
        weapon: 'machinegun',
        value: 50,
        color: '#ffcc00',
        radius: 0.25
    },
    weapon_shotgun: {
        name: 'Shotgun',
        type: 'weapon',
        weapon: 'shotgun',
        color: '#ff8800',
        radius: 0.4
    },
    weapon_machinegun: {
        name: 'Machine Gun',
        type: 'weapon',
        weapon: 'machinegun',
        color: '#ff0000',
        radius: 0.4
    }
};

// Loot listesi
let loots = [];

/**
 * Loot oluştur
 */
export function createLoot(type, x, y) {
    const template = LOOT_TYPES[type];
    if (!template) {
        console.error(`Bilinmeyen loot tipi: ${type}`);
        return null;
    }

    const loot = {
        id: Date.now() + Math.random(),
        type,
        x,
        y,
        ...template,
        bobOffset: Math.random() * Math.PI * 2, // Animasyon için
        collected: false
    };

    loots.push(loot);
    return loot;
}

/**
 * Rastgele loot oluştur
 */
export function spawnRandomLoot(x, y) {
    const rng = Math.random();

    let type;
    if (rng < 0.4) {
        type = 'health_small';
    } else if (rng < 0.55) {
        type = 'health_large';
    } else if (rng < 0.7) {
        type = 'ammo_shotgun';
    } else if (rng < 0.85) {
        type = 'ammo_machinegun';
    } else if (rng < 0.93) {
        type = 'weapon_shotgun';
    } else {
        type = 'weapon_machinegun';
    }

    return createLoot(type, x, y);
}

/**
 * Tüm lootları güncelle
 */
export function updateLoots(player, deltaTime) {
    const pickupRange = 0.8;

    for (const loot of loots) {
        if (loot.collected) continue;

        // Oyuncuya mesafe
        const dx = player.x - loot.x;
        const dy = player.y - loot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Toplama mesafesinde mi?
        if (dist < pickupRange) {
            collectLoot(loot, player);
        }
    }

    // Toplanmış lootları kaldır
    loots = loots.filter(l => !l.collected);
}

/**
 * Loot topla - her zaman toplanır, fayda varsa uygulanır
 */
function collectLoot(loot, player) {
    if (!loot || !player) return;

    const template = LOOT_TYPES[loot.type];
    if (!template) return;

    // Her zaman topla
    loot.collected = true;

    switch (template.type) {
        case 'health': {
            const oldHealth = player.health;
            player.health = Math.min(player.health + template.value, player.maxHealth);
            const gained = player.health - oldHealth;
            if (gained > 0) {
                console.log(`+${gained} HP`);
            }
            game.pickupFlash = { color: '#00ff00', intensity: 1, time: 0.2 };
            break;
        }

        case 'ammo': {
            const weapon = WEAPONS[template.weapon];
            if (weapon && weapon.maxAmmo !== Infinity) {
                addAmmo(template.weapon, template.value);
                console.log(`+${template.value} ${template.weapon} ammo`);
            }
            game.pickupFlash = { color: '#ffcc00', intensity: 1, time: 0.2 };
            break;
        }

        case 'weapon': {
            const wpn = WEAPONS[template.weapon];
            if (wpn) {
                const ammoAmount = wpn.maxAmmo === Infinity ? 0 : Math.floor(wpn.maxAmmo * 0.5);
                if (ammoAmount > 0) {
                    addAmmo(template.weapon, ammoAmount);
                }
                console.log(`${template.name} alindi!`);
            }
            game.pickupFlash = { color: '#ff8800', intensity: 1, time: 0.2 };
            break;
        }
    }
}

/**
 * Tüm lootları al
 */
export function getLoots() {
    return loots;
}

/**
 * Loot listesini temizle
 */
export function clearLoots() {
    loots = [];
}

/**
 * Haritadaki spawn noktalarına loot yerleştir
 */
export function spawnLootsFromMap(lootSpawns) {
    for (const spawn of lootSpawns) {
        spawnRandomLoot(spawn.x, spawn.y);
    }
}
