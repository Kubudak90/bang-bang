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
 * v2: Daha detaylı gölgeleme, outline ve ifadeler
 */
function renderEnemyColumn(ctx, screenX, centerY, height, spriteX, enemy) {
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

    // Renk (hurt flash efekti)
    let bodyColor = enemy.color;
    if (enemy.hurtFlash > 0.1) {
        bodyColor = lerpColor(enemy.color, '#ffffff', enemy.hurtFlash);
    }

    // Düşman tipine göre özellikler
    const isGrunt = enemy.type === 'grunt';
    const isShooter = enemy.type === 'shooter';
    const isCharger = enemy.type === 'charger';

    // Ten renkleri - tiplerine göre farklı (daha canlı)
    const skinColor = isCharger ? '#d4a574' : (isShooter ? '#e0b090' : '#f5c9a8');
    const skinColorDark = darkenColor(skinColor, 0.2);
    const skinColorLight = lightenColor(skinColor, 0.15);

    // Saç/kafa renkleri
    const hairColor = isCharger ? '#1a1a1a' : (isShooter ? '#3a2518' : '#2a1a0a');

    // Pantolon rengi (daha belirgin)
    const pantsColor = isCharger ? '#4a3020' : (isShooter ? '#2a4a2a' : '#3a4a6a');
    const pantsColorDark = darkenColor(pantsColor, 0.2);

    // Silah doğrultma animasyonu
    const isAiming = enemy.isAlert && (isShooter || isGrunt);
    const aimPhase = isAiming ? 0.3 + Math.sin(time * 3) * 0.05 : 0;

    // Mesafeye göre detay seviyesi (uzaktaysa basit çiz)
    const detailLevel = height > 60 ? 2 : (height > 30 ? 1 : 0);

    // Outline rengi (koyu gölge)
    const outlineColor = '#1a1210';

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
    const headLeft = 0.30;
    const headRight = 0.70;
    const headTop = isCharger ? 0.04 : -0.02; // Charger kask altında
    const headBottom = 0.18;

    if (x >= headLeft && x <= headRight) {
        const headX = (x - headLeft) / (headRight - headLeft);
        const distFromHeadCenter = Math.abs(headX - 0.5) * 2;

        if (distFromHeadCenter < 0.98) {
            const headHeight = (headBottom - headTop) * height;
            const headY = top + headTop * height;

            // Yüz tabanı - oval şekil için kenarları daralt
            const ovalFactor = 1 - Math.pow(distFromHeadCenter, 2) * 0.3;
            const faceTop = headY + headHeight * (0.1 * distFromHeadCenter);
            const faceHeight = headHeight * ovalFactor;

            // Yüz ana rengi
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, faceTop, 1, faceHeight);

            // Yüz highlight (ortada daha açık)
            if (distFromHeadCenter < 0.4 && detailLevel > 0) {
                ctx.fillStyle = skinColorLight;
                ctx.fillRect(screenX, faceTop + faceHeight * 0.2, 1, faceHeight * 0.4);
            }

            // Saç (Charger hariç - kask var)
            if (!isCharger) {
                ctx.fillStyle = hairColor;
                const hairHeight = headHeight * 0.32;
                ctx.fillRect(screenX, headY, 1, hairHeight);
                // Saç highlight
                if (distFromHeadCenter < 0.3 && detailLevel > 1) {
                    ctx.fillStyle = lightenColor(hairColor, 0.15);
                    ctx.fillRect(screenX, headY + hairHeight * 0.1, 1, hairHeight * 0.3);
                }
            }

            // Kaşlar (kızgın ifade - daha belirgin)
            if (distFromHeadCenter < 0.6 && distFromHeadCenter > 0.15) {
                ctx.fillStyle = hairColor;
                const browOffset = enemy.isAlert ? -headHeight * 0.03 : headHeight * 0.01;
                const browThickness = enemy.isAlert ? headHeight * 0.08 : headHeight * 0.05;
                ctx.fillRect(screenX, headY + headHeight * 0.34 + browOffset, 1, browThickness);
            }

            // Gözler - daha büyük ve belirgin
            if (distFromHeadCenter < 0.5 && distFromHeadCenter > 0.12) {
                const eyeY = headY + headHeight * 0.42;
                const eyeHeight = headHeight * 0.18;

                // Göz çukuru (koyu)
                if (detailLevel > 0) {
                    ctx.fillStyle = darkenColor(skinColor, 0.1);
                    ctx.fillRect(screenX, eyeY - eyeHeight * 0.1, 1, eyeHeight * 1.2);
                }

                // Göz akı
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(screenX, eyeY, 1, eyeHeight);

                // Göz bebeği - alert ise oyuncuya baksın
                const pupilOffset = enemy.isAlert ? (headX < 0.5 ? 0.015 : -0.015) : 0;
                const pupilColor = isCharger ? '#cc0000' : '#1a1a1a';
                ctx.fillStyle = pupilColor;
                ctx.fillRect(screenX, eyeY + eyeHeight * (0.25 + pupilOffset), 1, eyeHeight * 0.5);

                // İris (charger için kırmızı hale)
                if (detailLevel > 1 && !isCharger) {
                    ctx.fillStyle = '#4a3020';
                    ctx.fillRect(screenX, eyeY + eyeHeight * 0.2, 1, eyeHeight * 0.15);
                }

                // Göz parlaması - daha belirgin
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillRect(screenX, eyeY + eyeHeight * 0.1, 1, eyeHeight * 0.15);

                // Alt göz kapağı gölgesi
                if (detailLevel > 0) {
                    ctx.fillStyle = skinColorDark;
                    ctx.fillRect(screenX, eyeY + eyeHeight * 0.9, 1, eyeHeight * 0.2);
                }
            }

            // Burun - daha belirgin
            if (distFromHeadCenter < 0.12) {
                ctx.fillStyle = skinColorDark;
                ctx.fillRect(screenX, headY + headHeight * 0.52, 1, headHeight * 0.16);
                // Burun ucu
                if (detailLevel > 0) {
                    ctx.fillStyle = darkenColor(skinColor, 0.08);
                    ctx.fillRect(screenX, headY + headHeight * 0.62, 1, headHeight * 0.06);
                }
            }

            // Burun kanatları
            if (distFromHeadCenter > 0.08 && distFromHeadCenter < 0.18) {
                ctx.fillStyle = skinColorDark;
                ctx.fillRect(screenX, headY + headHeight * 0.62, 1, headHeight * 0.06);
            }

            // Ağız - tiplerine göre farklı ifade
            if (distFromHeadCenter < 0.25) {
                const mouthY = headY + headHeight * 0.72;

                if (isCharger && enemy.isAlert) {
                    // Charger bağırıyor - açık ağız
                    ctx.fillStyle = '#2a0808';
                    ctx.fillRect(screenX, mouthY, 1, headHeight * 0.18);
                    // Üst dişler
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(screenX, mouthY, 1, headHeight * 0.05);
                    // Alt dişler
                    ctx.fillRect(screenX, mouthY + headHeight * 0.13, 1, headHeight * 0.04);
                } else if (enemy.isAlert) {
                    // Kızgın ifade - sıkılmış ağız
                    ctx.fillStyle = '#5a2828';
                    ctx.fillRect(screenX, mouthY, 1, headHeight * 0.06);
                    // Dudak çizgisi
                    ctx.fillStyle = '#3a1818';
                    ctx.fillRect(screenX, mouthY + headHeight * 0.02, 1, headHeight * 0.02);
                } else {
                    // Normal ifade
                    ctx.fillStyle = '#8a4040';
                    ctx.fillRect(screenX, mouthY, 1, headHeight * 0.08);
                }
            }

            // Çene gölgesi
            if (distFromHeadCenter < 0.4) {
                ctx.fillStyle = skinColorDark;
                ctx.fillRect(screenX, headY + headHeight * 0.88, 1, headHeight * 0.1);
            }

            // Yüz kenar gölgesi (yanlarda) - gradient benzeri
            if (distFromHeadCenter > 0.5) {
                const shadowIntensity = (distFromHeadCenter - 0.5) * 0.4;
                ctx.fillStyle = darkenColor(skinColor, shadowIntensity);
                ctx.fillRect(screenX, faceTop, 1, faceHeight);
            }

            // Outline (en dışta)
            if (distFromHeadCenter > 0.85 && detailLevel > 0) {
                ctx.fillStyle = outlineColor;
                ctx.fillRect(screenX, faceTop, 1, faceHeight);
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
    const torsoTop = 0.20;
    const torsoBottom = 0.54;

    if (x >= 0.20 && x <= 0.80) {
        const torsoX = (x - 0.20) / 0.60;
        const distFromTorsoCenter = Math.abs(torsoX - 0.5) * 2;

        if (distFromTorsoCenter < 0.98) {
            const torsoHeight = (torsoBottom - torsoTop) * height;
            const torsoY = top + torsoTop * height;

            // Ana gövde - vücut şekli
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, torsoY, 1, torsoHeight);

            // Gövde highlight (ortada)
            if (distFromTorsoCenter < 0.3 && detailLevel > 0) {
                ctx.fillStyle = lightenColor(bodyColor, 0.1);
                ctx.fillRect(screenX, torsoY + torsoHeight * 0.1, 1, torsoHeight * 0.5);
            }

            // Charger: Zırh plakası
            if (isCharger) {
                if (distFromTorsoCenter < 0.65) {
                    // Ana zırh
                    ctx.fillStyle = '#4a4a4a';
                    ctx.fillRect(screenX, top + height * 0.24, 1, height * 0.26);

                    // Zırh detayları
                    if (detailLevel > 0) {
                        // Zırh çizgileri
                        if (distFromTorsoCenter > 0.3 && distFromTorsoCenter < 0.4) {
                            ctx.fillStyle = '#3a3a3a';
                            ctx.fillRect(screenX, top + height * 0.26, 1, height * 0.22);
                        }
                        // Orta plaka parlaması
                        if (distFromTorsoCenter < 0.2) {
                            ctx.fillStyle = '#6a6a6a';
                            ctx.fillRect(screenX, top + height * 0.28, 1, height * 0.12);
                        }
                    }

                    // Kırmızı gösterge ışığı (alert olunca yanar)
                    if (enemy.isAlert && distFromTorsoCenter < 0.1) {
                        const blink = Math.sin(time * 8) > 0;
                        ctx.fillStyle = blink ? '#ff3333' : '#660000';
                        ctx.fillRect(screenX, top + height * 0.42, 1, height * 0.03);
                    }
                }
            }

            // Shooter: Taktik yelek
            if (isShooter) {
                if (distFromTorsoCenter < 0.75) {
                    // Ana yelek
                    ctx.fillStyle = '#2a4a2a';
                    ctx.fillRect(screenX, top + height * 0.21, 1, height * 0.32);

                    // Yelek cepleri
                    if (torsoX > 0.2 && torsoX < 0.35) {
                        ctx.fillStyle = '#1a3a1a';
                        ctx.fillRect(screenX, top + height * 0.28, 1, height * 0.12);
                        // Cep kapağı
                        ctx.fillStyle = '#0a2a0a';
                        ctx.fillRect(screenX, top + height * 0.28, 1, height * 0.02);
                    }
                    if (torsoX > 0.65 && torsoX < 0.80) {
                        ctx.fillStyle = '#1a3a1a';
                        ctx.fillRect(screenX, top + height * 0.28, 1, height * 0.12);
                        ctx.fillStyle = '#0a2a0a';
                        ctx.fillRect(screenX, top + height * 0.28, 1, height * 0.02);
                    }

                    // Yelek fermuarı/ortası
                    if (distFromTorsoCenter < 0.08) {
                        ctx.fillStyle = '#3a5a3a';
                        ctx.fillRect(screenX, top + height * 0.22, 1, height * 0.30);
                    }
                }
            }

            // Grunt: T-shirt ve kemer
            if (isGrunt) {
                // Yaka
                if (distFromTorsoCenter < 0.3) {
                    ctx.fillStyle = darkenColor(bodyColor, 0.15);
                    ctx.fillRect(screenX, top + height * 0.20, 1, height * 0.04);
                }

                // Kemer
                if (torsoX > 0.25 && torsoX < 0.75) {
                    ctx.fillStyle = '#5a4a3a';
                    ctx.fillRect(screenX, top + height * 0.49, 1, height * 0.045);

                    // Kemer tokası
                    if (distFromTorsoCenter < 0.12) {
                        ctx.fillStyle = '#a09070';
                        ctx.fillRect(screenX, top + height * 0.495, 1, height * 0.035);
                        // Toka parlaması
                        if (detailLevel > 1) {
                            ctx.fillStyle = '#c0b090';
                            ctx.fillRect(screenX, top + height * 0.50, 1, height * 0.01);
                        }
                    }
                }
            }

            // Kenar gölgeleme - gradient benzeri
            if (distFromTorsoCenter > 0.5) {
                const shadowIntensity = (distFromTorsoCenter - 0.5) * 0.5;
                ctx.fillStyle = darkenColor(bodyColor, shadowIntensity);
                ctx.fillRect(screenX, torsoY, 1, torsoHeight);
            }

            // Outline
            if (distFromTorsoCenter > 0.88 && detailLevel > 0) {
                ctx.fillStyle = outlineColor;
                ctx.fillRect(screenX, torsoY, 1, torsoHeight);
            }
        }
    }

    // ============================================
    // === KOLLAR (animasyonlu) ===
    // ============================================
    const armSwing = walkPhase * 0.08; // Daha belirgin kol sallanması

    // Sol kol (nişan almıyorken normal sallanır)
    if (x >= 0.08 && x <= 0.24) {
        const armY = top + height * (0.22 + (isAiming ? 0 : armSwing));
        // Üst kol (giysi)
        ctx.fillStyle = bodyColor;
        ctx.fillRect(screenX, armY, 1, height * 0.16);
        // Alt kol (ten)
        ctx.fillStyle = skinColor;
        ctx.fillRect(screenX, armY + height * 0.14, 1, height * 0.14);
        // El
        ctx.fillStyle = skinColorDark;
        ctx.fillRect(screenX, armY + height * 0.26, 1, height * 0.04);

        // Sol el silah tutuyorsa (çift el nişan)
        if (isAiming && isShooter && x >= 0.12 && x <= 0.20) {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(screenX, armY + height * 0.12, 1, height * 0.08);
        }
    }

    // Sağ kol (silah tutan kol)
    if (x >= 0.76 && x <= 0.95) {
        // Nişan alırken kol öne uzanır
        const armYOffset = isAiming ? -0.08 : -armSwing;
        const armY = top + height * (0.22 + armYOffset);

        // Kol gövdeden ayrı çizilecek (nişan pozisyonu)
        if (isAiming) {
            // Üst kol (omuzdan dirseğe)
            ctx.fillStyle = bodyColor;
            ctx.fillRect(screenX, armY, 1, height * 0.12);
            // Alt kol (dirsekten bileğe) - öne uzanmış
            ctx.fillStyle = skinColor;
            ctx.fillRect(screenX, armY + height * 0.08, 1, height * 0.18);
            // El
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

        // Silah (Shooter ve Grunt için)
        if ((isShooter || isGrunt) && x >= 0.80 && x <= 0.95) {
            if (isAiming) {
                // Silah öne doğrultulmuş
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(screenX, armY + height * 0.10, 1, height * 0.14);
                // Namlu (oyuncuya doğru)
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(screenX, armY + height * 0.02, 1, height * 0.12);
                // Namlu ucu parlaması (ateş ediyorsa)
                if (Math.sin(time * 20) > 0.8 && enemy.isAlert) {
                    ctx.fillStyle = '#ff6600';
                    ctx.fillRect(screenX, armY - height * 0.02, 1, height * 0.06);
                }
            } else {
                // Silah aşağıda
                ctx.fillStyle = '#2a2a2a';
                ctx.fillRect(screenX, armY + height * 0.20, 1, height * 0.18);
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(screenX, armY + height * 0.36, 1, height * 0.08);
            }
        }

        // Charger'ın yumruğu (silah yok, yakın dövüş)
        if (isCharger && isAiming && x >= 0.85 && x <= 0.92) {
            ctx.fillStyle = '#4a4a4a'; // Metal eldiven
            ctx.fillRect(screenX, armY + height * 0.18, 1, height * 0.10);
        }
    }

    // ============================================
    // === BACAKLAR (animasyonlu) ===
    // ============================================
    const legSwing = walkPhase * 0.07; // Belirgin bacak hareketi
    const legBend = Math.abs(walkPhase) * 0.05; // Diz bükülmesi

    // Sol bacak
    if (x >= 0.26 && x <= 0.46) {
        const legX = (x - 0.26) / 0.20;
        const distFromLegCenter = Math.abs(legX - 0.5) * 2;
        const legOffset = legSwing;
        const legY = top + height * (0.54 + legOffset);
        const bendAmount = legSwing > 0 ? legBend : 0;

        // Üst bacak
        ctx.fillStyle = pantsColor;
        ctx.fillRect(screenX, legY, 1, height * (0.19 - bendAmount));

        // Bacak highlight
        if (distFromLegCenter < 0.4 && detailLevel > 0) {
            ctx.fillStyle = lightenColor(pantsColor, 0.1);
            ctx.fillRect(screenX, legY + height * 0.02, 1, height * 0.08);
        }

        // Alt bacak (diz bükülmesi ile)
        ctx.fillStyle = pantsColorDark;
        ctx.fillRect(screenX, legY + height * (0.17 - bendAmount), 1, height * (0.18 + bendAmount));

        // Ayakkabı
        const shoeColor = isCharger ? '#3a3a3a' : '#2a2a2a';
        ctx.fillStyle = shoeColor;
        ctx.fillRect(screenX, legY + height * 0.32, 1, height * 0.10);
        // Ayakkabı tabanı
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(screenX, legY + height * 0.40, 1, height * 0.02);

        // Charger: Dizlik
        if (isCharger) {
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(screenX, legY + height * 0.12, 1, height * 0.08);
            // Dizlik parlaması
            if (distFromLegCenter < 0.3) {
                ctx.fillStyle = '#7a7a7a';
                ctx.fillRect(screenX, legY + height * 0.13, 1, height * 0.03);
            }
        }

        // Bacak outline
        if (distFromLegCenter > 0.8 && detailLevel > 0) {
            ctx.fillStyle = outlineColor;
            ctx.fillRect(screenX, legY, 1, height * 0.42);
        }
    }

    // Sağ bacak
    if (x >= 0.54 && x <= 0.74) {
        const legX = (x - 0.54) / 0.20;
        const distFromLegCenter = Math.abs(legX - 0.5) * 2;
        const legOffset = -legSwing;
        const legY = top + height * (0.54 + legOffset);
        const bendAmount = legSwing < 0 ? legBend : 0;

        // Üst bacak
        ctx.fillStyle = pantsColor;
        ctx.fillRect(screenX, legY, 1, height * (0.19 - bendAmount));

        // Bacak highlight
        if (distFromLegCenter < 0.4 && detailLevel > 0) {
            ctx.fillStyle = lightenColor(pantsColor, 0.1);
            ctx.fillRect(screenX, legY + height * 0.02, 1, height * 0.08);
        }

        // Alt bacak
        ctx.fillStyle = pantsColorDark;
        ctx.fillRect(screenX, legY + height * (0.17 - bendAmount), 1, height * (0.18 + bendAmount));

        // Ayakkabı
        const shoeColor = isCharger ? '#3a3a3a' : '#2a2a2a';
        ctx.fillStyle = shoeColor;
        ctx.fillRect(screenX, legY + height * 0.32, 1, height * 0.10);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(screenX, legY + height * 0.40, 1, height * 0.02);

        // Charger: Dizlik
        if (isCharger) {
            ctx.fillStyle = '#5a5a5a';
            ctx.fillRect(screenX, legY + height * 0.12, 1, height * 0.08);
            if (distFromLegCenter < 0.3) {
                ctx.fillStyle = '#7a7a7a';
                ctx.fillRect(screenX, legY + height * 0.13, 1, height * 0.03);
            }
        }

        // Bacak outline
        if (distFromLegCenter > 0.8 && detailLevel > 0) {
            ctx.fillStyle = outlineColor;
            ctx.fillRect(screenX, legY, 1, height * 0.42);
        }
    }

    // ============================================
    // === ÖLÜM EFEKTİ ===
    // ============================================
    if (enemy.isDead) {
        // Kırmızı overlay
        const deathAlpha = enemy.deathTimer * 0.5;
        ctx.fillStyle = `rgba(180, 20, 20, ${deathAlpha})`;
        ctx.fillRect(screenX, top, 1, height);

        // Kan efekti - daha dramatik
        const bloodY = top + height * 0.25;
        const bloodHeight = height * 0.5;
        ctx.fillStyle = `rgba(100, 0, 0, ${enemy.deathTimer * 0.6})`;
        ctx.fillRect(screenX, bloodY, 1, bloodHeight);

        // Parçalanma efekti (ölürken)
        if (enemy.deathTimer < 0.5 && Math.random() > 0.7) {
            ctx.fillStyle = `rgba(80, 0, 0, ${enemy.deathTimer})`;
            const particleY = top + Math.random() * height;
            ctx.fillRect(screenX, particleY, 1, height * 0.05);
        }
    }

    // ============================================
    // === ALERT DURUMU - ÜNLEM İŞARETİ ===
    // ============================================
    if (enemy.isAlert && !enemy.isDead && x > 0.42 && x < 0.58) {
        const alertY = top - height * 0.15;
        const pulseScale = 1 + Math.sin(time * 12) * 0.15;
        const pulseAlpha = 0.6 + Math.sin(time * 8) * 0.3;

        // Ünlem işareti arka planı
        if (x > 0.46 && x < 0.54) {
            // Kırmızı daire
            ctx.fillStyle = `rgba(220, 40, 40, ${pulseAlpha})`;
            ctx.fillRect(screenX, alertY, 1, height * 0.10 * pulseScale);

            // Ünlem çubuğu
            if (x > 0.48 && x < 0.52) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(screenX, alertY + height * 0.02, 1, height * 0.05);
                // Ünlem noktası
                ctx.fillRect(screenX, alertY + height * 0.08, 1, height * 0.015);
            }
        }
    }
}

/**
 * Loot sprite'ı render et
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
