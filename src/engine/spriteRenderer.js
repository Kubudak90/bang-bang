// SpriteRenderer - düşmanları, oyuncuları ve loot'ları (billboard sprites) ekrana çiz
// Enhanced: 8-directional sprites + alpha blending support

import { SCREEN, RAYCASTER } from '../core/config.js';
import { game, getLocalPlayer, getAllPlayers } from '../core/game.js';
import { getLoots } from '../world/loot.js';
import { getLightingSystem } from './lighting.js';

// 8-yönlü sprite sistemi için sabitler
const SPRITE_DIRECTIONS = {
    FRONT: 0,       // Oyuncuya bakıyor
    FRONT_RIGHT: 1, // 45° sağ
    RIGHT: 2,       // 90° sağ (profil)
    BACK_RIGHT: 3,  // 135° sağ
    BACK: 4,        // Arkası dönük
    BACK_LEFT: 5,   // 135° sol
    LEFT: 6,        // 90° sol (profil)
    FRONT_LEFT: 7   // 45° sol
};

// Alpha blending için global canvas context referansı
let spriteCtx = null;
let spriteImageData = null;
let spriteBuffer = null;

/**
 * Sprite yönünü hesapla (8-yönlü sistem)
 * @param {number} entityAngle - Entity'nin baktığı açı (radyan)
 * @param {number} viewAngle - Oyuncudan entity'ye açı (radyan)
 * @returns {number} Sprite yönü (0-7)
 */
function calculateSpriteDirection(entityAngle, viewAngle) {
    // Entity'nin oyuncuya göre göreceli açısı
    // viewAngle: oyuncudan entity'ye
    // entityAngle: entity'nin baktığı yön
    // Fark: entity oyuncuya mı bakıyor?

    let relativeAngle = entityAngle - viewAngle;

    // Normalize to 0 - 2π
    while (relativeAngle < 0) relativeAngle += Math.PI * 2;
    while (relativeAngle >= Math.PI * 2) relativeAngle -= Math.PI * 2;

    // 8 yöne böl (her biri 45° = π/4)
    // 0 = arkadan bakıyoruz (entity bizden uzağa bakıyor)
    // π = önden bakıyoruz (entity bize bakıyor)

    const sector = Math.floor(((relativeAngle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));

    // Mapping: sector -> sprite direction
    // sector 0 (entity bize arkasını dönmüş) = BACK
    // sector 4 (entity bize bakıyor) = FRONT
    const directionMap = [
        SPRITE_DIRECTIONS.BACK,         // 0
        SPRITE_DIRECTIONS.BACK_LEFT,    // 1
        SPRITE_DIRECTIONS.LEFT,         // 2
        SPRITE_DIRECTIONS.FRONT_LEFT,   // 3
        SPRITE_DIRECTIONS.FRONT,        // 4
        SPRITE_DIRECTIONS.FRONT_RIGHT,  // 5
        SPRITE_DIRECTIONS.RIGHT,        // 6
        SPRITE_DIRECTIONS.BACK_RIGHT    // 7
    ];

    return directionMap[sector % 8];
}

/**
 * Alpha blending ile piksel çiz
 */
function blendPixel(ctx, x, y, r, g, b, a) {
    if (a <= 0) return;
    if (a >= 1) {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
        return;
    }
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(x, y, 1, 1);
}

/**
 * Tüm sprite'ları render et
 * Duvarlardan sonra, silahtan önce çağrılmalı
 */
export function renderSprites(ctx, rays) {
    // Görüş noktası olan oyuncu
    const viewPlayer = game.mode === 'multiplayer' ? game.localPlayer : game.player;
    if (!viewPlayer) return;

    // Pitch offset
    const pitch = viewPlayer.pitch || 0;

    const enemies = game.enemies || [];
    const loots = getLoots() || [];

    // Tüm sprite'ları birleştir
    const allSprites = [];

    // Multiplayer: Diğer oyuncuları ekle
    if (game.mode === 'multiplayer') {
        for (const [playerId, player] of game.players) {
            // Kendimizi çizme
            if (playerId === game.clientId) continue;
            // Ölü oyuncuları çizme
            if (player.state === 'dead') continue;

            // Interpolation sonucu pozisyonu kullan
            const px = player.renderX ?? player.x;
            const py = player.renderY ?? player.y;

            const dx = px - viewPlayer.x;
            const dy = py - viewPlayer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            allSprites.push({
                type: 'player',
                entity: player,
                dist,
                angle,
                color: player.color || '#ff4444',
                radius: 0.3
            });
        }
    }

    // Düşmanlar (singleplayer only)
    if (game.mode !== 'multiplayer') {
        for (const enemy of enemies) {
            if (enemy.isDead && enemy.deathTimer <= 0) continue;

            const dx = enemy.x - viewPlayer.x;
            const dy = enemy.y - viewPlayer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            allSprites.push({
                type: 'enemy',
                entity: enemy,
                dist,
                angle,
                color: enemy.color,
                radius: enemy.radius
            });
        }
    }

    // Loot'lar
    for (const loot of loots) {
        if (loot.collected) continue;

        const dx = loot.x - viewPlayer.x;
        const dy = loot.y - viewPlayer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        allSprites.push({
            type: 'loot',
            entity: loot,
            dist,
            angle,
            color: loot.color,
            radius: loot.radius
        });
    }

    // Mesafeye göre sırala (uzaktan yakına - painter's algorithm)
    allSprites.sort((a, b) => b.dist - a.dist);

    // Her sprite'ı çiz
    for (const sprite of allSprites) {
        if (sprite.type === 'enemy') {
            renderEnemySprite(ctx, sprite.entity, sprite.dist, sprite.angle, rays, viewPlayer, pitch);
        } else if (sprite.type === 'player') {
            renderRemotePlayerSprite(ctx, sprite.entity, sprite.dist, sprite.angle, rays, viewPlayer, pitch);
        } else if (sprite.type === 'loot') {
            renderLootSprite(ctx, sprite.entity, sprite.dist, sprite.angle, rays, viewPlayer, pitch);
        }
    }
}

/**
 * Uzak oyuncu sprite'ı render et
 * Enhanced: Dinamik ışıklandırma
 */
function renderRemotePlayerSprite(ctx, player, dist, angle, rays, viewPlayer, pitch = 0) {
    let angleDiff = angle - viewPlayer.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > RAYCASTER.FOV / 2 + 0.3) return;

    const screenX = SCREEN.WIDTH / 2 + (angleDiff / RAYCASTER.FOV) * SCREEN.WIDTH;
    const spriteHeight = (1 / dist) * SCREEN.HEIGHT * 0.8;
    const spriteWidth = spriteHeight * 0.6;
    const screenY = SCREEN.HEIGHT / 2 + pitch;

    // Dinamik ışıklandırma hesapla
    let lightIntensity = 1.0;
    const lighting = getLightingSystem();
    const px = player.renderX ?? player.x;
    const py = player.renderY ?? player.y;
    if (lighting) {
        const lightInfo = lighting.calculateLightAt(
            px, py,
            viewPlayer.x, viewPlayer.y, viewPlayer.angle
        );
        lightIntensity = Math.min(1.5, 0.4 + lightInfo.intensity * 0.8);
    }
    // Mesafe bazlı karartma
    const distanceDim = Math.max(0.3, 1 - dist / RAYCASTER.MAX_DEPTH);
    lightIntensity *= distanceDim;

    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const spriteRight = Math.floor(screenX + spriteWidth / 2);

    for (let x = Math.max(0, spriteLeft); x < Math.min(SCREEN.WIDTH, spriteRight); x++) {
        const rayDist = rays[x] ? rays[x].correctedDistance : Infinity;
        if (dist > rayDist) continue;

        const spriteXRatio = (x - spriteLeft) / spriteWidth;
        renderPlayerColumn(ctx, x, screenY, spriteHeight, spriteXRatio, player, lightIntensity);
    }
}

/**
 * Oyuncu sprite sütunu - basit insan figürü
 * Enhanced: Dinamik ışıklandırma
 */
function renderPlayerColumn(ctx, screenX, centerY, height, spriteX, player, lightMult = 1.0) {
    const halfHeight = height / 2;
    const top = centerY - halfHeight;
    const x = spriteX;

    const bodyColor = applyLightToColor(player.color || '#ff4444', lightMult);
    const skinColor = applyLightToColor('#e8b89d', lightMult);
    const hairColor = applyLightToColor('#2a1a0a', lightMult);
    const pantsColor = applyLightToColor('#2a3a5a', lightMult);
    const shoeColor = applyLightToColor('#1a1a1a', lightMult);

    // Kafa
    if (x >= 0.35 && x <= 0.65) {
        const distFromCenter = Math.abs(x - 0.5) * 2;
        if (distFromCenter < 0.9) {
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, top + height * 0.02, 1, height * 0.16);
            // Saç
            ctx.fillStyle = hairColor;
            ctx.fillRect(screenX, top + height * 0.02, 1, height * 0.05);
        }
    }

    // Gövde
    if (x >= 0.25 && x <= 0.75) {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX, top + height * 0.20, 1, height * 0.35);
    }

    // Kollar
    if ((x >= 0.10 && x <= 0.25) || (x >= 0.75 && x <= 0.90)) {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX, top + height * 0.22, 1, height * 0.25);
        ctx.fillStyle = skinColor;
        ctx.fillRect(screenX, top + height * 0.42, 1, height * 0.08);
    }

    // Bacaklar
    if ((x >= 0.30 && x <= 0.45) || (x >= 0.55 && x <= 0.70)) {
        ctx.fillStyle = pantsColor;
        ctx.fillRect(screenX, top + height * 0.55, 1, height * 0.38);
        ctx.fillStyle = shoeColor;
        ctx.fillRect(screenX, top + height * 0.90, 1, height * 0.08);
    }

    // İsim (üstte) - ışıktan bağımsız
    if (x > 0.45 && x < 0.55) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(screenX - 25, top - height * 0.15, 50, 12);
    }
}

/**
 * Düşman sprite'ı render et
 * Enhanced: 8-yönlü sprite desteği ve dinamik ışıklandırma
 */
function renderEnemySprite(ctx, enemy, dist, angle, rays, viewPlayer, pitch = 0) {
    const player = viewPlayer;

    // Oyuncuya göre açı farkı
    let angleDiff = angle - player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // FOV dışındaysa çizme
    if (Math.abs(angleDiff) > RAYCASTER.FOV / 2 + 0.3) return;

    // Ekrandaki X pozisyonu
    const screenX = SCREEN.WIDTH / 2 + (angleDiff / RAYCASTER.FOV) * SCREEN.WIDTH;

    // Sprite boyutu (mesafeye göre)
    const spriteHeight = (1 / dist) * SCREEN.HEIGHT * 0.8;
    const spriteWidth = spriteHeight * 0.8;

    // Ekrandaki Y pozisyonu (pitch offset ile)
    const screenY = SCREEN.HEIGHT / 2 + pitch;

    // Ölüm animasyonu
    let scale = 1;
    let offsetY = 0;
    if (enemy.isDead) {
        scale = enemy.deathTimer;
        offsetY = (1 - enemy.deathTimer) * spriteHeight * 0.5;
    }

    // 8-yönlü sprite hesaplaması
    // Oyuncudan düşmana bakış açısını hesapla (enemy'nin görüş yönüne göre)
    const spriteDirection = calculateSpriteDirection(enemy.angle, angle + Math.PI);

    // Dinamik ışıklandırma hesapla
    let lightIntensity = 1.0;
    const lighting = getLightingSystem();
    if (lighting) {
        const lightInfo = lighting.calculateLightAt(
            enemy.x, enemy.y,
            player.x, player.y, player.angle
        );
        lightIntensity = Math.min(1.5, 0.4 + lightInfo.intensity * 0.8);
    }

    // Mesafe bazlı karartma
    const distanceDim = Math.max(0.3, 1 - dist / RAYCASTER.MAX_DEPTH);
    lightIntensity *= distanceDim;

    // Z-buffer kontrolü
    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const spriteRight = Math.floor(screenX + spriteWidth / 2);

    for (let x = Math.max(0, spriteLeft); x < Math.min(SCREEN.WIDTH, spriteRight); x++) {
        const rayDist = rays[x] ? rays[x].correctedDistance : Infinity;
        if (dist > rayDist) continue;

        const spriteXRatio = (x - spriteLeft) / spriteWidth;
        renderEnemyColumn(ctx, x, screenY + offsetY, spriteHeight * scale, spriteXRatio, enemy, spriteDirection, lightIntensity);
    }
}

/**
 * Düşman sprite sütunu - Gelişmiş insan karakteri
 * Her düşman tipi farklı görünüme sahip
 * Enhanced: 8-yönlü sprite desteği ve dinamik ışıklandırma
 * @param {number} spriteDir - Sprite yönü (0-7, SPRITE_DIRECTIONS)
 * @param {number} lightMult - Işık çarpanı (0-1.5)
 */
function renderEnemyColumn(ctx, screenX, centerY, height, spriteX, enemy, spriteDir = SPRITE_DIRECTIONS.FRONT, lightMult = 1.0) {
    const halfHeight = height / 2;
    const x = spriteX;
    const time = performance.now() / 1000;

    // Yürüme animasyonu - daha belirgin
    const isMoving = enemy.isAlert && !enemy.isDead;
    const walkSpeed = enemy.type === 'charger' ? 14 : 10;
    const walkPhase = isMoving ? Math.sin(time * walkSpeed) : 0;

    // Vücut sallanması (yürürken yukarı aşağı)
    const bodyBob = isMoving ? Math.abs(Math.sin(time * walkSpeed * 2)) * height * 0.02 : 0;
    const top = centerY - halfHeight + bodyBob;

    // Renk (hurt flash efekti + ışık)
    let bodyColor = enemy.color;
    if (enemy.hurtFlash > 0.1) {
        bodyColor = lerpColor(enemy.color, '#ffffff', enemy.hurtFlash);
    }
    // Işık efekti uygula
    bodyColor = applyLightToColor(bodyColor, lightMult);

    // Düşman tipine göre özellikler
    const isGrunt = enemy.type === 'grunt';
    const isShooter = enemy.type === 'shooter';
    const isCharger = enemy.type === 'charger';

    // Ten renkleri - tiplerine göre farklı (ışık uygula)
    const skinColorBase = isCharger ? '#c9a87c' : (isShooter ? '#d4a574' : '#e8b89d');
    const skinColor = applyLightToColor(skinColorBase, lightMult);
    const skinColorDark = darkenColor(skinColor, 0.15);

    // Saç/kafa renkleri
    const hairColorBase = isCharger ? '#1a1a1a' : (isShooter ? '#4a3728' : '#2a1a0a');
    const hairColor = applyLightToColor(hairColorBase, lightMult);

    // Pantolon rengi
    const pantsColorBase = isCharger ? '#3a2a1a' : (isShooter ? '#1a3a1a' : '#2a3a5a');
    const pantsColor = applyLightToColor(pantsColorBase, lightMult);

    // Silah doğrultma animasyonu (sadece FRONT yönlerinde)
    const isFacingPlayer = spriteDir === SPRITE_DIRECTIONS.FRONT ||
                           spriteDir === SPRITE_DIRECTIONS.FRONT_LEFT ||
                           spriteDir === SPRITE_DIRECTIONS.FRONT_RIGHT;
    const isAiming = enemy.isAlert && (isShooter || isGrunt) && isFacingPlayer;
    const aimPhase = isAiming ? 0.3 + Math.sin(time * 3) * 0.05 : 0;

    // Profil/arka görünüm bayrakları
    const isProfile = spriteDir === SPRITE_DIRECTIONS.LEFT || spriteDir === SPRITE_DIRECTIONS.RIGHT;
    const isBack = spriteDir === SPRITE_DIRECTIONS.BACK ||
                   spriteDir === SPRITE_DIRECTIONS.BACK_LEFT ||
                   spriteDir === SPRITE_DIRECTIONS.BACK_RIGHT;
    const isLeftSide = spriteDir === SPRITE_DIRECTIONS.LEFT ||
                       spriteDir === SPRITE_DIRECTIONS.FRONT_LEFT ||
                       spriteDir === SPRITE_DIRECTIONS.BACK_LEFT;

    // ============================================
    // === CHARGER: KASK ===
    // ============================================
    if (isCharger && x >= 0.28 && x <= 0.72) {
        const helmetY = top - height * 0.02;
        const helmetHeight = height * 0.18;
        const distFromCenter = Math.abs(x - 0.5) * 2;

        if (distFromCenter < 0.9) {
            // Kask gövdesi (koyu metal)
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(screenX, helmetY, 1, helmetHeight);

            // Kask parlaması
            if (distFromCenter < 0.3) {
                ctx.fillStyle = '#5a5a5a';
                ctx.fillRect(screenX, helmetY, 1, helmetHeight * 0.4);
            }

            // Vizör (kırmızı)
            if (distFromCenter < 0.5 && distFromCenter > 0.1) {
                ctx.fillStyle = '#ff3333';
                ctx.fillRect(screenX, helmetY + helmetHeight * 0.5, 1, helmetHeight * 0.25);
            }
        }
    }

    // ============================================
    // === KAFA (8-yönlü) ===
    // ============================================
    const headLeft = isProfile ? 0.35 : 0.32;
    const headRight = isProfile ? 0.70 : 0.68;
    const headTop = isCharger ? 0.04 : 0.0;
    const headBottom = 0.16;

    if (x >= headLeft && x <= headRight) {
        const headX = (x - headLeft) / (headRight - headLeft);
        const distFromHeadCenter = Math.abs(headX - 0.5) * 2;

        if (distFromHeadCenter < 0.95) {
            const headHeight = (headBottom - headTop) * height;
            const headY = top + headTop * height;

            // Temel kafa rengi
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, headY, 1, headHeight);

            if (isBack) {
                // === ARKADAN GÖRÜNÜM ===
                // Sadece saç/kask görünür
                if (!isCharger) {
                    ctx.fillStyle = hairColor;
                    ctx.fillRect(screenX, headY, 1, headHeight * 0.75);
                    // Ense
                    ctx.fillStyle = skinColorDark;
                    ctx.fillRect(screenX, headY + headHeight * 0.75, 1, headHeight * 0.20);
                }
            } else if (isProfile) {
                // === PROFİL GÖRÜNÜM ===
                // Saç (Charger hariç)
                if (!isCharger) {
                    ctx.fillStyle = hairColor;
                    if (isLeftSide) {
                        // Sol profil - saç sağda daha çok
                        if (headX > 0.4) {
                            ctx.fillRect(screenX, headY, 1, headHeight * 0.40);
                        } else {
                            ctx.fillRect(screenX, headY, 1, headHeight * 0.25);
                        }
                    } else {
                        // Sağ profil - saç solda daha çok
                        if (headX < 0.6) {
                            ctx.fillRect(screenX, headY, 1, headHeight * 0.40);
                        } else {
                            ctx.fillRect(screenX, headY, 1, headHeight * 0.25);
                        }
                    }
                }

                // Tek göz (profilde)
                const eyeCenter = isLeftSide ? 0.35 : 0.65;
                if (Math.abs(headX - eyeCenter) < 0.15) {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(screenX, headY + headHeight * 0.42, 1, headHeight * 0.14);
                    ctx.fillStyle = isCharger ? '#ff0000' : '#000';
                    ctx.fillRect(screenX, headY + headHeight * 0.46, 1, headHeight * 0.08);
                }

                // Burun (profile - çıkıntı)
                const nosePos = isLeftSide ? 0.15 : 0.85;
                if (Math.abs(headX - nosePos) < 0.12) {
                    ctx.fillStyle = skinColor;
                    ctx.fillRect(screenX, headY + headHeight * 0.45, 1, headHeight * 0.20);
                }

                // Kulak (karşı tarafta)
                const earPos = isLeftSide ? 0.85 : 0.15;
                if (Math.abs(headX - earPos) < 0.10) {
                    ctx.fillStyle = skinColorDark;
                    ctx.fillRect(screenX, headY + headHeight * 0.35, 1, headHeight * 0.25);
                }

                // Ağız (profile)
                if (Math.abs(headX - (isLeftSide ? 0.25 : 0.75)) < 0.12) {
                    ctx.fillStyle = '#6a3030';
                    ctx.fillRect(screenX, headY + headHeight * 0.72, 1, headHeight * 0.08);
                }
            } else {
                // === ÖNDEN GÖRÜNÜM (orijinal) ===
                // Saç (Charger hariç - kask var)
                if (!isCharger) {
                    ctx.fillStyle = hairColor;
                    ctx.fillRect(screenX, headY, 1, headHeight * 0.28);
                }

                // Kaşlar (kızgın ifade)
                if (distFromHeadCenter < 0.65 && distFromHeadCenter > 0.2) {
                    ctx.fillStyle = hairColor;
                    const browOffset = enemy.isAlert ? headHeight * 0.02 : 0;
                    ctx.fillRect(screenX, headY + headHeight * 0.32 + browOffset, 1, headHeight * 0.06);
                }

                // Gözler
                if (distFromHeadCenter < 0.55 && distFromHeadCenter > 0.15) {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(screenX, headY + headHeight * 0.42, 1, headHeight * 0.14);

                    const pupilOffset = enemy.isAlert ? (x < 0.5 ? 0.02 : -0.02) : 0;
                    ctx.fillStyle = isCharger ? '#ff0000' : '#000';
                    ctx.fillRect(screenX, headY + headHeight * (0.46 + pupilOffset), 1, headHeight * 0.08);

                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.fillRect(screenX, headY + headHeight * 0.43, 1, headHeight * 0.03);
                }

                // Burun
                if (distFromHeadCenter < 0.15) {
                    ctx.fillStyle = skinColorDark;
                    ctx.fillRect(screenX, headY + headHeight * 0.55, 1, headHeight * 0.12);
                }

                // Ağız
                if (distFromHeadCenter < 0.3) {
                    if (isCharger && enemy.isAlert) {
                        ctx.fillStyle = '#2a0a0a';
                        ctx.fillRect(screenX, headY + headHeight * 0.72, 1, headHeight * 0.15);
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(screenX, headY + headHeight * 0.73, 1, headHeight * 0.04);
                    } else {
                        ctx.fillStyle = '#6a3030';
                        ctx.fillRect(screenX, headY + headHeight * 0.75, 1, headHeight * 0.08);
                    }
                }

                // Yüz gölgesi (yanlarda)
                if (distFromHeadCenter > 0.6) {
                    ctx.fillStyle = skinColorDark;
                    ctx.fillRect(screenX, headY + headHeight * 0.3, 1, headHeight * 0.5);
                }
            }
        }
    }

    // ============================================
    // === BOYUN ===
    // ============================================
    if (x >= 0.40 && x <= 0.60) {
        ctx.fillStyle = skinColorDark;
        ctx.fillRect(screenX, top + height * 0.16, 1, height * 0.05);
    }

    // ============================================
    // === GÖVDE ===
    // ============================================
    const torsoTop = 0.21;
    const torsoBottom = 0.55;

    if (x >= 0.22 && x <= 0.78) {
        const torsoX = (x - 0.22) / 0.56;
        const distFromTorsoCenter = Math.abs(torsoX - 0.5) * 2;

        if (distFromTorsoCenter < 0.95) {
            // Ana gövde
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, top + torsoTop * height, 1, (torsoBottom - torsoTop) * height);

            // Charger: Zırh plakası
            if (isCharger) {
                if (distFromTorsoCenter < 0.6) {
                    ctx.fillStyle = '#4a4a4a';
                    ctx.fillRect(screenX, top + height * 0.25, 1, height * 0.25);
                    // Zırh parlaması
                    if (distFromTorsoCenter < 0.2) {
                        ctx.fillStyle = '#6a6a6a';
                        ctx.fillRect(screenX, top + height * 0.26, 1, height * 0.08);
                    }
                }
            }

            // Shooter: Yelek
            if (isShooter) {
                if (distFromTorsoCenter < 0.7) {
                    ctx.fillStyle = '#2a4a2a';
                    ctx.fillRect(screenX, top + height * 0.22, 1, height * 0.30);
                    // Yelek cebi
                    if (x > 0.35 && x < 0.45) {
                        ctx.fillStyle = '#1a3a1a';
                        ctx.fillRect(screenX, top + height * 0.32, 1, height * 0.08);
                    }
                }
            }

            // Grunt: Kemer
            if (isGrunt && x > 0.35 && x < 0.65) {
                ctx.fillStyle = '#4a3a2a';
                ctx.fillRect(screenX, top + height * 0.50, 1, height * 0.04);
                // Kemer tokası
                if (x > 0.47 && x < 0.53) {
                    ctx.fillStyle = '#8a7a5a';
                    ctx.fillRect(screenX, top + height * 0.505, 1, height * 0.03);
                }
            }

            // Gölgeleme
            if (distFromTorsoCenter > 0.6) {
                ctx.fillStyle = darkenColor(bodyColor, 0.25);
                ctx.fillRect(screenX, top + torsoTop * height, 1, (torsoBottom - torsoTop) * height);
            }
        }
    }

    // ============================================
    // === KOLLAR (animasyonlu, 8-yönlü) ===
    // ============================================
    const armSwing = walkPhase * 0.08;

    if (isBack) {
        // === ARKADAN GÖRÜNÜM - iki kol simetrik ===
        // Sol kol
        if (x >= 0.12 && x <= 0.28) {
            const armY = top + height * (0.22 + armSwing);
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, armY, 1, height * 0.16);
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.12);
        }
        // Sağ kol
        if (x >= 0.72 && x <= 0.88) {
            const armY = top + height * (0.22 - armSwing);
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, armY, 1, height * 0.16);
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.12);
            // Silah görünsün (arkadan)
            if ((isShooter || isGrunt) && x >= 0.78 && x <= 0.86) {
                ctx.fillStyle = applyLightToColor('#2a2a2a', lightMult);
                ctx.fillRect(screenX, armY + height * 0.10, 1, height * 0.20);
            }
        }
    } else if (isProfile) {
        // === PROFİL GÖRÜNÜM - tek taraflı kollar ===
        const armCenter = isLeftSide ? 0.60 : 0.40;
        if (Math.abs(x - armCenter) < 0.15) {
            const armY = top + height * (0.22 + armSwing * (isLeftSide ? 1 : -1));
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, armY, 1, height * 0.18);
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, armY + height * 0.16, 1, height * 0.12);
            ctx.fillStyle = skinColorDark;
            ctx.fillRect(screenX, armY + height * 0.26, 1, height * 0.04);

            // Silah (profilde yatay görünür)
            if ((isShooter || isGrunt) && Math.abs(x - armCenter) < 0.08) {
                ctx.fillStyle = applyLightToColor('#2a2a2a', lightMult);
                ctx.fillRect(screenX, armY + height * 0.20, 1, height * 0.06);
                ctx.fillStyle = applyLightToColor('#1a1a1a', lightMult);
                ctx.fillRect(screenX, armY + height * 0.16, 1, height * 0.06);
            }
        }
    } else {
        // === ÖNDEN GÖRÜNÜM (orijinal + ışık) ===
        // Sol kol
        if (x >= 0.08 && x <= 0.24) {
            const armY = top + height * (0.22 + (isAiming ? 0 : armSwing));
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, armY, 1, height * 0.16);
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.14);
            ctx.fillStyle = skinColorDark;
            ctx.fillRect(screenX, armY + height * 0.26, 1, height * 0.04);

            if (isAiming && isShooter && x >= 0.12 && x <= 0.20) {
                ctx.fillStyle = applyLightToColor('#1a1a1a', lightMult);
                ctx.fillRect(screenX, armY + height * 0.12, 1, height * 0.08);
            }
        }

        // Sağ kol (silah tutan kol)
        if (x >= 0.76 && x <= 0.95) {
            const armYOffset = isAiming ? -0.08 : -armSwing;
            const armY = top + height * (0.22 + armYOffset);

            if (isAiming) {
                ctx.fillStyle = bodyColor;
                ctx.fillRect(screenX, armY, 1, height * 0.12);
                ctx.fillStyle = skinColor;
                ctx.fillRect(screenX, armY + height * 0.08, 1, height * 0.18);
                ctx.fillStyle = skinColorDark;
                ctx.fillRect(screenX, armY + height * 0.22, 1, height * 0.06);
            } else {
                ctx.fillStyle = bodyColor;
                ctx.fillRect(screenX, armY, 1, height * 0.16);
                ctx.fillStyle = skinColor;
                ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.14);
                ctx.fillStyle = skinColorDark;
                ctx.fillRect(screenX, armY + height * 0.26, 1, height * 0.04);
            }

            // Silah
            if ((isShooter || isGrunt) && x >= 0.80 && x <= 0.95) {
                if (isAiming) {
                    ctx.fillStyle = applyLightToColor('#3a3a3a', lightMult);
                    ctx.fillRect(screenX, armY + height * 0.10, 1, height * 0.14);
                    ctx.fillStyle = applyLightToColor('#1a1a1a', lightMult);
                    ctx.fillRect(screenX, armY + height * 0.02, 1, height * 0.12);
                    // Namlu parlaması
                    if (Math.sin(time * 20) > 0.8 && enemy.isAlert) {
                        ctx.fillStyle = '#ff6600';
                        ctx.fillRect(screenX, armY - height * 0.02, 1, height * 0.06);
                    }
                } else {
                    ctx.fillStyle = applyLightToColor('#2a2a2a', lightMult);
                    ctx.fillRect(screenX, armY + height * 0.20, 1, height * 0.18);
                    ctx.fillStyle = applyLightToColor('#1a1a1a', lightMult);
                    ctx.fillRect(screenX, armY + height * 0.36, 1, height * 0.08);
                }
            }

            // Charger yumruğu
            if (isCharger && isAiming && x >= 0.85 && x <= 0.92) {
                ctx.fillStyle = applyLightToColor('#4a4a4a', lightMult);
                ctx.fillRect(screenX, armY + height * 0.18, 1, height * 0.10);
            }
        }
    }

    // ============================================
    // === BACAKLAR (animasyonlu, 8-yönlü) ===
    // ============================================
    const legSwing = walkPhase * 0.06;
    const legBend = Math.abs(walkPhase) * 0.04;
    const shoeColor = applyLightToColor(isCharger ? '#2a2a2a' : '#1a1a1a', lightMult);
    const kneepadColor = applyLightToColor('#4a4a4a', lightMult);
    const pantsColorDark = darkenColor(pantsColor, 0.1);

    if (isBack) {
        // === ARKADAN GÖRÜNÜM ===
        // Sol bacak
        if (x >= 0.30 && x <= 0.46) {
            const legY = top + height * (0.55 + legSwing);
            ctx.fillStyle = pantsColor;
            ctx.fillRect(screenX, legY, 1, height * 0.17);
            ctx.fillStyle = pantsColorDark;
            ctx.fillRect(screenX, legY + height * 0.16, 1, height * 0.16);
            ctx.fillStyle = shoeColor;
            ctx.fillRect(screenX, legY + height * 0.30, 1, height * 0.09);
        }
        // Sağ bacak
        if (x >= 0.54 && x <= 0.70) {
            const legY = top + height * (0.55 - legSwing);
            ctx.fillStyle = pantsColor;
            ctx.fillRect(screenX, legY, 1, height * 0.17);
            ctx.fillStyle = pantsColorDark;
            ctx.fillRect(screenX, legY + height * 0.16, 1, height * 0.16);
            ctx.fillStyle = shoeColor;
            ctx.fillRect(screenX, legY + height * 0.30, 1, height * 0.09);
        }
    } else if (isProfile) {
        // === PROFİL GÖRÜNÜM - iki bacak üst üste ===
        const legCenterFront = isLeftSide ? 0.45 : 0.55;
        const legCenterBack = isLeftSide ? 0.55 : 0.45;

        // Arka bacak (biraz geride)
        if (Math.abs(x - legCenterBack) < 0.12) {
            const legY = top + height * (0.55 - legSwing);
            ctx.fillStyle = pantsColorDark;
            ctx.fillRect(screenX, legY, 1, height * 0.32);
            ctx.fillStyle = darkenColor(shoeColor, 0.15);
            ctx.fillRect(screenX, legY + height * 0.30, 1, height * 0.09);
        }
        // Ön bacak
        if (Math.abs(x - legCenterFront) < 0.12) {
            const legY = top + height * (0.55 + legSwing);
            ctx.fillStyle = pantsColor;
            ctx.fillRect(screenX, legY, 1, height * 0.32);
            ctx.fillStyle = shoeColor;
            ctx.fillRect(screenX, legY + height * 0.30, 1, height * 0.09);
            if (isCharger) {
                ctx.fillStyle = kneepadColor;
                ctx.fillRect(screenX, legY + height * 0.10, 1, height * 0.08);
            }
        }
    } else {
        // === ÖNDEN GÖRÜNÜM (orijinal) ===
        // Sol bacak
        if (x >= 0.28 && x <= 0.46) {
            const legOffset = legSwing;
            const legY = top + height * (0.55 + legOffset);
            const bendAmount = legSwing > 0 ? legBend : 0;

            ctx.fillStyle = pantsColor;
            ctx.fillRect(screenX, legY, 1, height * (0.18 - bendAmount));
            ctx.fillStyle = pantsColorDark;
            ctx.fillRect(screenX, legY + height * (0.16 - bendAmount), 1, height * (0.17 + bendAmount));
            ctx.fillStyle = shoeColor;
            ctx.fillRect(screenX, legY + height * 0.31, 1, height * 0.09);

            if (isCharger) {
                ctx.fillStyle = kneepadColor;
                ctx.fillRect(screenX, legY + height * 0.10, 1, height * 0.08);
            }
        }

        // Sağ bacak
        if (x >= 0.54 && x <= 0.72) {
            const legOffset = -legSwing;
            const legY = top + height * (0.55 + legOffset);
            const bendAmount = legSwing < 0 ? legBend : 0;

            ctx.fillStyle = pantsColor;
            ctx.fillRect(screenX, legY, 1, height * (0.18 - bendAmount));
            ctx.fillStyle = pantsColorDark;
            ctx.fillRect(screenX, legY + height * (0.16 - bendAmount), 1, height * (0.17 + bendAmount));
            ctx.fillStyle = shoeColor;
            ctx.fillRect(screenX, legY + height * 0.31, 1, height * 0.09);

            if (isCharger) {
                ctx.fillStyle = kneepadColor;
                ctx.fillRect(screenX, legY + height * 0.10, 1, height * 0.08);
            }
        }
    }

    // ============================================
    // === ÖLÜM EFEKTİ ===
    // ============================================
    if (enemy.isDead) {
        ctx.fillStyle = `rgba(255, 0, 0, ${enemy.deathTimer * 0.6})`;
        ctx.fillRect(screenX, top, 1, height);
        // Kan efekti
        ctx.fillStyle = `rgba(139, 0, 0, ${enemy.deathTimer * 0.4})`;
        ctx.fillRect(screenX, top + height * 0.3, 1, height * 0.4);
    }

    // ============================================
    // === ALERT DURUMU - KIRMIZI GÖSTERGE ===
    // ============================================
    if (enemy.isAlert && !enemy.isDead && x > 0.45 && x < 0.55) {
        const pulseAlpha = 0.3 + Math.sin(time * 10) * 0.2;
        ctx.fillStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        ctx.fillRect(screenX, top - height * 0.08, 1, height * 0.05);
    }
}

/**
 * Loot sprite'ı render et
 * Enhanced: Dinamik ışıklandırma
 */
function renderLootSprite(ctx, loot, dist, angle, rays, viewPlayer, pitch = 0) {
    const player = viewPlayer;

    let angleDiff = angle - player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > RAYCASTER.FOV / 2 + 0.3) return;

    const screenX = SCREEN.WIDTH / 2 + (angleDiff / RAYCASTER.FOV) * SCREEN.WIDTH;

    // Loot daha küçük
    const spriteHeight = (0.5 / dist) * SCREEN.HEIGHT * 0.6;
    const spriteWidth = spriteHeight;

    // Yerde duruyor (biraz aşağıda, pitch offset ile)
    const screenY = SCREEN.HEIGHT / 2 + spriteHeight * 0.5 + pitch;

    // Yukarı aşağı sallanma animasyonu
    const bobAmount = Math.sin(performance.now() / 300 + loot.bobOffset) * 5;

    // Dinamik ışıklandırma hesapla
    let lightIntensity = 1.0;
    const lighting = getLightingSystem();
    if (lighting) {
        const lightInfo = lighting.calculateLightAt(
            loot.x, loot.y,
            player.x, player.y, player.angle
        );
        lightIntensity = Math.min(1.5, 0.5 + lightInfo.intensity * 0.7);
    }
    // Mesafe bazlı karartma
    const distanceDim = Math.max(0.4, 1 - dist / RAYCASTER.MAX_DEPTH);
    lightIntensity *= distanceDim;

    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const spriteRight = Math.floor(screenX + spriteWidth / 2);

    for (let x = Math.max(0, spriteLeft); x < Math.min(SCREEN.WIDTH, spriteRight); x++) {
        const rayDist = rays[x] ? rays[x].correctedDistance : Infinity;
        if (dist > rayDist) continue;

        const spriteXRatio = (x - spriteLeft) / spriteWidth;
        renderLootColumn(ctx, x, screenY + bobAmount, spriteHeight, spriteXRatio, loot, lightIntensity);
    }
}

/**
 * Loot sprite sütunu
 * Enhanced: Dinamik ışıklandırma
 */
function renderLootColumn(ctx, screenX, centerY, height, spriteX, loot, lightMult = 1.0) {
    const halfHeight = height / 2;
    const top = centerY - halfHeight;

    const distFromCenter = Math.abs(spriteX - 0.5) * 2;

    // Daire şeklinde loot
    if (distFromCenter > 0.85) return;

    // Ana renk (ışık uygula)
    const baseColor = applyLightToColor(loot.color, lightMult);
    ctx.fillStyle = baseColor;
    ctx.fillRect(screenX, top + height * 0.2, 1, height * 0.6);

    // Parlama efekti (ortada)
    if (distFromCenter < 0.3) {
        ctx.fillStyle = lightenColor(baseColor, 0.5);
        ctx.fillRect(screenX, top + height * 0.3, 1, height * 0.4);
    }

    // Glow efekti (loot'un kendisi parladığı için ışıktan bağımsız)
    const glowIntensity = 0.3 + Math.sin(performance.now() / 200) * 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${glowIntensity * (1 - distFromCenter)})`;
    ctx.fillRect(screenX, top + height * 0.1, 1, height * 0.8);
}

/**
 * Renkleri karıştır (lerp)
 */
function lerpColor(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `rgb(${r},${g},${b})`;
}

/**
 * Rengi açıklaştır
 */
function lightenColor(color, amount) {
    const r = Math.min(255, parseInt(color.slice(1, 3), 16) + amount * 255);
    const g = Math.min(255, parseInt(color.slice(3, 5), 16) + amount * 255);
    const b = Math.min(255, parseInt(color.slice(5, 7), 16) + amount * 255);
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * Rengi koyulaştır
 */
function darkenColor(color, amount) {
    let r, g, b;

    if (color.startsWith('#')) {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        r = parseInt(match[0]);
        g = parseInt(match[1]);
        b = parseInt(match[2]);
    } else {
        return color;
    }

    r = Math.max(0, r - amount * 255);
    g = Math.max(0, g - amount * 255);
    b = Math.max(0, b - amount * 255);

    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * Işık çarpanını renge uygula (dinamik aydınlatma için)
 * @param {string} color - Hex veya rgb renk
 * @param {number} lightMultiplier - Işık çarpanı (0-1.5)
 * @returns {string} RGB renk string
 */
function applyLightToColor(color, lightMultiplier) {
    let r, g, b;

    if (color.startsWith('#')) {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (!match) return color;
        r = parseInt(match[0]);
        g = parseInt(match[1]);
        b = parseInt(match[2]);
    } else {
        return color;
    }

    // Işık çarpanı uygula
    r = Math.min(255, Math.max(0, Math.round(r * lightMultiplier)));
    g = Math.min(255, Math.max(0, Math.round(g * lightMultiplier)));
    b = Math.min(255, Math.max(0, Math.round(b * lightMultiplier)));

    return `rgb(${r},${g},${b})`;
}

/**
 * RGBA string oluştur (alpha blending için)
 */
function rgba(r, g, b, a) {
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

/**
 * Rengi alpha ile çiz (semi-transparent render için)
 */
function fillWithAlpha(ctx, x, y, w, h, color, alpha) {
    if (alpha >= 1) {
        ctx.fillStyle = color;
    } else {
        // Rengi parse et ve alpha ekle
        let r, g, b;
        if (color.startsWith('#')) {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        } else if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            r = parseInt(match[0]);
            g = parseInt(match[1]);
            b = parseInt(match[2]);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
            return;
        }
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    }
    ctx.fillRect(x, y, w, h);
}
