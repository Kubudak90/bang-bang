// SpriteRenderer - düşmanları, oyuncuları ve loot'ları (billboard sprites) ekrana çiz

import { SCREEN, RAYCASTER } from '../core/config.js';
import { game, getLocalPlayer, getAllPlayers } from '../core/game.js';
import { getLoots } from '../world/loot.js';

/**
 * Tüm sprite'ları render et
 * Duvarlardan sonra, silahtan önce çağrılmalı
 */
export function renderSprites(ctx, rays) {
    // Görüş noktası olan oyuncu
    const viewPlayer = game.mode === 'multiplayer' ? game.localPlayer : game.player;
    if (!viewPlayer) return;

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
            renderEnemySprite(ctx, sprite.entity, sprite.dist, sprite.angle, rays, viewPlayer);
        } else if (sprite.type === 'player') {
            renderRemotePlayerSprite(ctx, sprite.entity, sprite.dist, sprite.angle, rays, viewPlayer);
        } else if (sprite.type === 'loot') {
            renderLootSprite(ctx, sprite.entity, sprite.dist, sprite.angle, rays, viewPlayer);
        }
    }
}

/**
 * Uzak oyuncu sprite'ı render et
 */
function renderRemotePlayerSprite(ctx, player, dist, angle, rays, viewPlayer) {
    let angleDiff = angle - viewPlayer.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > RAYCASTER.FOV / 2 + 0.3) return;

    const screenX = SCREEN.WIDTH / 2 + (angleDiff / RAYCASTER.FOV) * SCREEN.WIDTH;
    const spriteHeight = (1 / dist) * SCREEN.HEIGHT * 0.8;
    const spriteWidth = spriteHeight * 0.6;
    const screenY = SCREEN.HEIGHT / 2;

    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const spriteRight = Math.floor(screenX + spriteWidth / 2);

    for (let x = Math.max(0, spriteLeft); x < Math.min(SCREEN.WIDTH, spriteRight); x++) {
        const rayDist = rays[x] ? rays[x].correctedDistance : Infinity;
        if (dist > rayDist) continue;

        const spriteXRatio = (x - spriteLeft) / spriteWidth;
        renderPlayerColumn(ctx, x, screenY, spriteHeight, spriteXRatio, player);
    }
}

/**
 * Oyuncu sprite sütunu - basit insan figürü
 */
function renderPlayerColumn(ctx, screenX, centerY, height, spriteX, player) {
    const halfHeight = height / 2;
    const top = centerY - halfHeight;
    const x = spriteX;

    const bodyColor = player.color || '#ff4444';
    const skinColor = '#e8b89d';

    // Kafa
    if (x >= 0.35 && x <= 0.65) {
        const distFromCenter = Math.abs(x - 0.5) * 2;
        if (distFromCenter < 0.9) {
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, top + height * 0.02, 1, height * 0.16);
            // Saç
            ctx.fillStyle = '#2a1a0a';
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
        ctx.fillStyle = '#2a3a5a';
        ctx.fillRect(screenX, top + height * 0.55, 1, height * 0.38);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(screenX, top + height * 0.90, 1, height * 0.08);
    }

    // İsim (üstte)
    if (x > 0.45 && x < 0.55) {
        // Nametag arka planı
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(screenX - 25, top - height * 0.15, 50, 12);
    }
}

/**
 * Düşman sprite'ı render et
 */
function renderEnemySprite(ctx, enemy, dist, angle, rays, viewPlayer) {
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

    // Ekrandaki Y pozisyonu (ortada)
    const screenY = SCREEN.HEIGHT / 2;

    // Ölüm animasyonu
    let scale = 1;
    let offsetY = 0;
    if (enemy.isDead) {
        scale = enemy.deathTimer;
        offsetY = (1 - enemy.deathTimer) * spriteHeight * 0.5;
    }

    // Z-buffer kontrolü
    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const spriteRight = Math.floor(screenX + spriteWidth / 2);

    for (let x = Math.max(0, spriteLeft); x < Math.min(SCREEN.WIDTH, spriteRight); x++) {
        const rayDist = rays[x] ? rays[x].correctedDistance : Infinity;
        if (dist > rayDist) continue;

        const spriteXRatio = (x - spriteLeft) / spriteWidth;
        renderEnemyColumn(ctx, x, screenY + offsetY, spriteHeight * scale, spriteXRatio, enemy);
    }
}

/**
 * Düşman sprite sütunu - Gelişmiş insan karakteri
 * Her düşman tipi farklı görünüme sahip
 */
function renderEnemyColumn(ctx, screenX, centerY, height, spriteX, enemy) {
    const halfHeight = height / 2;
    const top = centerY - halfHeight;
    const x = spriteX;
    const time = performance.now() / 1000;

    // Animasyon fazı (yürüme için)
    const walkPhase = enemy.isAlert ? Math.sin(time * 8) * 0.5 : 0;

    // Renk (hurt flash efekti)
    let bodyColor = enemy.color;
    if (enemy.hurtFlash > 0.1) {
        bodyColor = lerpColor(enemy.color, '#ffffff', enemy.hurtFlash);
    }

    // Düşman tipine göre özellikler
    const isGrunt = enemy.type === 'grunt';
    const isShooter = enemy.type === 'shooter';
    const isCharger = enemy.type === 'charger';

    // Ten renkleri - tiplerine göre farklı
    const skinColor = isCharger ? '#c9a87c' : (isShooter ? '#d4a574' : '#e8b89d');
    const skinColorDark = darkenColor(skinColor, 0.15);

    // Saç/kafa renkleri
    const hairColor = isCharger ? '#1a1a1a' : (isShooter ? '#4a3728' : '#2a1a0a');

    // Pantolon rengi
    const pantsColor = isCharger ? '#3a2a1a' : (isShooter ? '#1a3a1a' : '#2a3a5a');

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
    // === KAFA ===
    // ============================================
    const headLeft = 0.32;
    const headRight = 0.68;
    const headTop = isCharger ? 0.04 : 0.0; // Charger kask altında
    const headBottom = 0.16;

    if (x >= headLeft && x <= headRight) {
        const headX = (x - headLeft) / (headRight - headLeft);
        const distFromHeadCenter = Math.abs(headX - 0.5) * 2;

        if (distFromHeadCenter < 0.95) {
            const headHeight = (headBottom - headTop) * height;
            const headY = top + headTop * height;

            // Yüz
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, headY, 1, headHeight);

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
                // Göz akı
                ctx.fillStyle = '#fff';
                ctx.fillRect(screenX, headY + headHeight * 0.42, 1, headHeight * 0.14);

                // Göz bebeği - alert ise oyuncuya baksın
                const pupilOffset = enemy.isAlert ? (x < 0.5 ? 0.02 : -0.02) : 0;
                ctx.fillStyle = isCharger ? '#ff0000' : '#000';
                ctx.fillRect(screenX, headY + headHeight * (0.46 + pupilOffset), 1, headHeight * 0.08);

                // Göz parlaması
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(screenX, headY + headHeight * 0.43, 1, headHeight * 0.03);
            }

            // Burun
            if (distFromHeadCenter < 0.15) {
                ctx.fillStyle = skinColorDark;
                ctx.fillRect(screenX, headY + headHeight * 0.55, 1, headHeight * 0.12);
            }

            // Ağız - tiplerine göre farklı ifade
            if (distFromHeadCenter < 0.3) {
                if (isCharger && enemy.isAlert) {
                    // Charger bağırıyor
                    ctx.fillStyle = '#2a0a0a';
                    ctx.fillRect(screenX, headY + headHeight * 0.72, 1, headHeight * 0.15);
                    // Dişler
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
    // === KOLLAR (animasyonlu) ===
    // ============================================
    const armSwing = walkPhase * 0.03; // Kol sallanması

    // Sol kol
    if (x >= 0.08 && x <= 0.24) {
        const armY = top + height * (0.22 + armSwing);
        // Üst kol (giysi)
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX, armY, 1, height * 0.16);
        // Alt kol (ten)
        ctx.fillStyle = skinColor;
        ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.14);
        // El
        ctx.fillStyle = skinColorDark;
        ctx.fillRect(screenX, armY + height * 0.26, 1, height * 0.04);
    }

    // Sağ kol
    if (x >= 0.76 && x <= 0.92) {
        const armY = top + height * (0.22 - armSwing);
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX, armY, 1, height * 0.16);
        ctx.fillStyle = skinColor;
        ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.14);
        ctx.fillStyle = skinColorDark;
        ctx.fillRect(screenX, armY + height * 0.26, 1, height * 0.04);

        // Shooter: Silah
        if (isShooter && x >= 0.82 && x <= 0.90) {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(screenX, armY + height * 0.20, 1, height * 0.18);
            // Silah namlusu
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(screenX, armY + height * 0.16, 1, height * 0.06);
        }
    }

    // ============================================
    // === BACAKLAR (animasyonlu) ===
    // ============================================
    const legSwing = walkPhase * 0.02;

    // Sol bacak
    if (x >= 0.28 && x <= 0.46) {
        const legY = top + height * (0.55 + legSwing);
        ctx.fillStyle = pantsColor;
        ctx.fillRect(screenX, legY, 1, height * 0.35);
        // Ayakkabı
        ctx.fillStyle = isCharger ? '#2a2a2a' : '#1a1a1a';
        ctx.fillRect(screenX, legY + height * 0.33, 1, height * 0.07);

        // Charger: Dizlik
        if (isCharger) {
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(screenX, legY + height * 0.12, 1, height * 0.08);
        }
    }

    // Sağ bacak
    if (x >= 0.54 && x <= 0.72) {
        const legY = top + height * (0.55 - legSwing);
        ctx.fillStyle = pantsColor;
        ctx.fillRect(screenX, legY, 1, height * 0.35);
        ctx.fillStyle = isCharger ? '#2a2a2a' : '#1a1a1a';
        ctx.fillRect(screenX, legY + height * 0.33, 1, height * 0.07);

        if (isCharger) {
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(screenX, legY + height * 0.12, 1, height * 0.08);
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
 */
function renderLootSprite(ctx, loot, dist, angle, rays, viewPlayer) {
    const player = viewPlayer;

    let angleDiff = angle - player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > RAYCASTER.FOV / 2 + 0.3) return;

    const screenX = SCREEN.WIDTH / 2 + (angleDiff / RAYCASTER.FOV) * SCREEN.WIDTH;

    // Loot daha küçük
    const spriteHeight = (0.5 / dist) * SCREEN.HEIGHT * 0.6;
    const spriteWidth = spriteHeight;

    // Yerde duruyor (biraz aşağıda)
    const screenY = SCREEN.HEIGHT / 2 + spriteHeight * 0.5;

    // Yukarı aşağı sallanma animasyonu
    const bobAmount = Math.sin(performance.now() / 300 + loot.bobOffset) * 5;

    const spriteLeft = Math.floor(screenX - spriteWidth / 2);
    const spriteRight = Math.floor(screenX + spriteWidth / 2);

    for (let x = Math.max(0, spriteLeft); x < Math.min(SCREEN.WIDTH, spriteRight); x++) {
        const rayDist = rays[x] ? rays[x].correctedDistance : Infinity;
        if (dist > rayDist) continue;

        const spriteXRatio = (x - spriteLeft) / spriteWidth;
        renderLootColumn(ctx, x, screenY + bobAmount, spriteHeight, spriteXRatio, loot);
    }
}

/**
 * Loot sprite sütunu
 */
function renderLootColumn(ctx, screenX, centerY, height, spriteX, loot) {
    const halfHeight = height / 2;
    const top = centerY - halfHeight;

    const distFromCenter = Math.abs(spriteX - 0.5) * 2;

    // Daire şeklinde loot
    if (distFromCenter > 0.85) return;

    // Ana renk
    ctx.fillStyle = loot.color;
    ctx.fillRect(screenX, top + height * 0.2, 1, height * 0.6);

    // Parlama efekti (ortada)
    if (distFromCenter < 0.3) {
        ctx.fillStyle = lightenColor(loot.color, 0.5);
        ctx.fillRect(screenX, top + height * 0.3, 1, height * 0.4);
    }

    // Glow efekti
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
