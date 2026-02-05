// Perk - güçlendirme sistemi
// Run içi geçici buff'lar

import { game } from '../core/game.js';
import { WEAPONS } from './weapon.js';
import { PLAYER } from '../core/config.js';

// Perk tanımları
export const PERKS = {
    // === SALDIRI PERKLERİ ===
    rapidFire: {
        id: 'rapidFire',
        name: 'Rapid Fire',
        description: 'Ateş hızı %25 artar',
        icon: '🔥',
        color: '#ff4400',
        maxStacks: 3,
        apply: (player, stacks) => {
            player.perkMods.fireRateMultiplier = 1 - (0.25 * stacks);
        }
    },
    damageBoost: {
        id: 'damageBoost',
        name: 'Damage Boost',
        description: 'Hasar %20 artar',
        icon: '💥',
        color: '#ff0000',
        maxStacks: 4,
        apply: (player, stacks) => {
            player.perkMods.damageMultiplier = 1 + (0.20 * stacks);
        }
    },
    biggerExplosions: {
        id: 'biggerExplosions',
        name: 'Bigger Explosions',
        description: 'Patlama yarıçapı %30 artar',
        icon: '💣',
        color: '#ff6600',
        maxStacks: 2,
        apply: (player, stacks) => {
            player.perkMods.splashRadiusMultiplier = 1 + (0.30 * stacks);
        }
    },

    // === SAVUNMA PERKLERİ ===
    thickSkin: {
        id: 'thickSkin',
        name: 'Thick Skin',
        description: 'Alınan hasar %15 azalır',
        icon: '🛡️',
        color: '#4488ff',
        maxStacks: 4,
        apply: (player, stacks) => {
            player.perkMods.damageReduction = 0.15 * stacks;
        }
    },
    regeneration: {
        id: 'regeneration',
        name: 'Regeneration',
        description: 'Saniyede 2 can yenilenir',
        icon: '❤️',
        color: '#00ff00',
        maxStacks: 3,
        apply: (player, stacks) => {
            player.perkMods.healthRegen = 2 * stacks;
        }
    },
    vampiric: {
        id: 'vampiric',
        name: 'Vampiric',
        description: 'Verilen hasarın %10\'u can olarak geri döner',
        icon: '🧛',
        color: '#880088',
        maxStacks: 2,
        apply: (player, stacks) => {
            player.perkMods.lifesteal = 0.10 * stacks;
        }
    },

    // === MOBİLİTE PERKLERİ ===
    speedDemon: {
        id: 'speedDemon',
        name: 'Speed Demon',
        description: 'Hareket hızı %15 artar',
        icon: '⚡',
        color: '#ffff00',
        maxStacks: 3,
        apply: (player, stacks) => {
            player.perkMods.speedMultiplier = 1 + (0.15 * stacks);
        }
    },
    nimble: {
        id: 'nimble',
        name: 'Nimble',
        description: 'Eğilme sırasında hareket hızı azalmaz',
        icon: '🦎',
        color: '#00ffaa',
        maxStacks: 1,
        apply: (player, stacks) => {
            player.perkMods.crouchSpeedPenalty = 0;
        }
    }
};

// Perk pool (level'a göre hangi perklerin çıkabileceği)
export const PERK_POOLS = {
    common: ['rapidFire', 'damageBoost', 'thickSkin', 'speedDemon'],
    uncommon: ['regeneration', 'biggerExplosions', 'nimble'],
    rare: ['vampiric']
};

/**
 * Oyuncuya perk modifier'larını başlat
 */
export function initPlayerPerks(player) {
    player.perks = {}; // { perkId: stackCount }
    player.perkMods = getDefaultPerkMods();
}

/**
 * Varsayılan perk modifier değerleri
 */
function getDefaultPerkMods() {
    return {
        fireRateMultiplier: 1.0,
        damageMultiplier: 1.0,
        splashRadiusMultiplier: 1.0,
        damageReduction: 0,
        healthRegen: 0,
        lifesteal: 0,
        speedMultiplier: 1.0,
        crouchSpeedPenalty: PLAYER.CROUCH_MULTIPLIER
    };
}

/**
 * Oyuncuya perk ekle
 */
export function addPerk(player, perkId) {
    const perk = PERKS[perkId];
    if (!perk) {
        console.error(`Bilinmeyen perk: ${perkId}`);
        return false;
    }

    // Stack kontrolü
    const currentStacks = player.perks[perkId] || 0;
    if (currentStacks >= perk.maxStacks) {
        console.log(`${perk.name} maksimum stack'e ulaştı (${perk.maxStacks})`);
        return false;
    }

    // Perk ekle
    player.perks[perkId] = currentStacks + 1;

    // Tüm perkleri yeniden uygula
    recalculatePerks(player);

    console.log(`✨ ${perk.name} eklendi! (${player.perks[perkId]}/${perk.maxStacks})`);
    return true;
}

/**
 * Oyuncunun perklerini yeniden hesapla
 */
function recalculatePerks(player) {
    // Önce varsayılana sıfırla
    player.perkMods = getDefaultPerkMods();

    // Tüm perkleri uygula
    for (const [perkId, stacks] of Object.entries(player.perks)) {
        const perk = PERKS[perkId];
        if (perk && perk.apply) {
            perk.apply(player, stacks);
        }
    }
}

/**
 * Perk güncelle (her frame - regeneration vb. için)
 */
export function updatePerks(player, deltaTime) {
    if (!player.perkMods) return;

    // Regeneration
    if (player.perkMods.healthRegen > 0) {
        player.health = Math.min(
            player.maxHealth,
            player.health + player.perkMods.healthRegen * deltaTime
        );
    }
}

/**
 * Hasar hesaplama (perk modifierlı)
 */
export function calculateDamage(baseDamage, player) {
    if (!player.perkMods) return baseDamage;
    return Math.floor(baseDamage * player.perkMods.damageMultiplier);
}

/**
 * Alınan hasarı hesapla (perk modifierlı)
 */
export function calculateDamageTaken(baseDamage, player) {
    if (!player.perkMods) return baseDamage;
    const reduction = player.perkMods.damageReduction || 0;
    return Math.floor(baseDamage * (1 - reduction));
}

/**
 * Ateş hızı çarpanını al
 */
export function getFireRateMultiplier(player) {
    if (!player.perkMods) return 1;
    return player.perkMods.fireRateMultiplier;
}

/**
 * Hız çarpanını al
 */
export function getSpeedMultiplier(player) {
    if (!player.perkMods) return 1;
    return player.perkMods.speedMultiplier;
}

/**
 * Splash yarıçap çarpanını al
 */
export function getSplashRadiusMultiplier(player) {
    if (!player.perkMods) return 1;
    return player.perkMods.splashRadiusMultiplier;
}

/**
 * Lifesteal uygulaması (hasar verildiğinde çağrılır)
 */
export function applyLifesteal(player, damageDealt) {
    if (!player.perkMods || player.perkMods.lifesteal <= 0) return 0;

    const healAmount = Math.floor(damageDealt * player.perkMods.lifesteal);
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    return healAmount;
}

/**
 * Rastgele perk seç (level'a göre)
 */
export function getRandomPerk(level = 1) {
    // Level'a göre rarity şansı
    let pool;
    const roll = Math.random();

    if (level >= 5 && roll < 0.1) {
        pool = PERK_POOLS.rare;
    } else if (level >= 3 && roll < 0.3) {
        pool = PERK_POOLS.uncommon;
    } else {
        pool = PERK_POOLS.common;
    }

    const perkId = pool[Math.floor(Math.random() * pool.length)];
    return PERKS[perkId];
}

/**
 * Perk seçim ekranı için 3 rastgele perk al
 */
export function getPerkChoices(level = 1, excludeMaxed = null) {
    const choices = [];
    const allPerks = Object.keys(PERKS);
    const available = allPerks.filter(id => {
        // Maksimum stack'e ulaşmış perkleri hariç tut
        if (excludeMaxed && excludeMaxed[id] >= PERKS[id].maxStacks) {
            return false;
        }
        return true;
    });

    // 3 farklı perk seç
    while (choices.length < 3 && available.length > choices.length) {
        const perk = getRandomPerk(level);
        if (!choices.find(c => c.id === perk.id) && available.includes(perk.id)) {
            choices.push(perk);
        }
    }

    return choices;
}

/**
 * Oyuncunun aktif perkleri
 */
export function getActivePerks(player) {
    if (!player.perks) return [];

    return Object.entries(player.perks).map(([perkId, stacks]) => ({
        ...PERKS[perkId],
        stacks
    }));
}

/**
 * Tüm perkleri temizle (yeni run)
 */
export function clearPerks(player) {
    player.perks = {};
    player.perkMods = getDefaultPerkMods();
}
