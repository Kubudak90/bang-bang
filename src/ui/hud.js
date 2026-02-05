// HUD - ekran üstü bilgiler
// Enhanced: Boss HP bar, damage numbers, perk display

import { SCREEN } from '../core/config.js';
import { game } from '../core/game.js';
import { radToDeg } from '../core/utils.js';
import { getCurrentWeapon } from '../player/weapon.js';
import { getActivePerks, PERKS } from '../player/perk.js';
import { hasActiveBoss, getBossHealthPercent } from '../enemies/boss.js';

// DOM referansları (cache)
let debugElement = null;

// Damage numbers sistemi
const damageNumbers = [];
const MAX_DAMAGE_NUMBERS = 20;

/**
 * Damage number ekle
 */
export function addDamageNumber(x, y, damage, isCrit = false) {
    if (damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
        damageNumbers.shift();
    }

    damageNumbers.push({
        worldX: x,
        worldY: y,
        damage,
        isCrit,
        life: 1.0,
        offsetY: 0,
        vx: (Math.random() - 0.5) * 20,
        vy: -30
    });
}

/**
 * Damage numbers güncelle
 */
function updateDamageNumbers(deltaTime) {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const dn = damageNumbers[i];
        dn.life -= deltaTime * 1.5;
        dn.offsetY += dn.vy * deltaTime;
        dn.vy += 50 * deltaTime; // Gravity
        dn.worldX += dn.vx * deltaTime * 0.1;

        if (dn.life <= 0) {
            damageNumbers.splice(i, 1);
        }
    }
}

/**
 * Damage numbers render
 */
function renderDamageNumbers(ctx, player) {
    for (const dn of damageNumbers) {
        // Dünya koordinatlarından ekran koordinatlarına
        const dx = dn.worldX - player.x;
        const dy = dn.worldY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 15) continue;

        // Basit projeksiyon
        const angle = Math.atan2(dy, dx) - player.angle;
        const screenX = SCREEN.WIDTH / 2 + Math.sin(angle) * (SCREEN.WIDTH / dist);
        const screenY = SCREEN.HEIGHT / 2 + dn.offsetY;

        if (screenX < 0 || screenX > SCREEN.WIDTH) continue;

        const alpha = dn.life;
        const scale = dn.isCrit ? 1.5 : 1.0;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.floor(14 * scale)}px monospace`;
        ctx.textAlign = 'center';

        // Gölge
        ctx.fillStyle = '#000';
        ctx.fillText(dn.damage.toString(), screenX + 1, screenY + 1);

        // Ana renk
        ctx.fillStyle = dn.isCrit ? '#ff0' : '#fff';
        ctx.fillText(dn.damage.toString(), screenX, screenY);

        ctx.restore();
    }
}

/**
 * Debug bilgilerini güncelle
 */
export function updateDebugInfo(player) {
    if (!game.debug.showFps) return;

    if (!debugElement) {
        debugElement = document.getElementById('debug-info');
        if (!debugElement) return;
    }

    const angle = radToDeg(player.angle).toFixed(1);
    const enemyCount = game.enemies ? game.enemies.length : 0;

    debugElement.innerHTML = `
        FPS: ${game.fps}<br>
        Pos: ${player.x.toFixed(2)}, ${player.y.toFixed(2)}<br>
        Angle: ${angle}°<br>
        Enemies: ${enemyCount}<br>
        ${game.debug.noclip ? '<span style="color:#0f0">NOCLIP</span>' : ''}
    `;
}

/**
 * Oyun HUD'ını render et (canvas üzerine)
 */
export function renderHud(ctx, player) {
    // Delta time al
    const dt = game.deltaTime || 0.016;

    // Damage numbers güncelle
    updateDamageNumbers(dt);

    // Sağlık barı
    renderHealthBar(ctx, player);

    // Silah ve mermi
    renderAmmoDisplay(ctx);

    // Skor
    renderScore(ctx);

    // Aktif perkler
    renderActivePerks(ctx, player);

    // Boss HP bar (varsa)
    if (hasActiveBoss()) {
        renderBossHealthBar(ctx);
    }

    // Damage numbers
    renderDamageNumbers(ctx, player);

    // Hasar flash efekti
    renderDamageFlash(ctx);

    // Crosshair
    renderCrosshair(ctx);

    // Game Over ekranı
    if (game.isGameOver) {
        renderGameOver(ctx);
    }
}

/**
 * Sağlık barı
 */
function renderHealthBar(ctx, player) {
    const x = 20;
    const y = SCREEN.HEIGHT - 30;
    const width = 150;
    const height = 20;

    // Arka plan
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, width, height);

    // Sağlık
    const healthPercent = Math.max(0, player.health / player.maxHealth);
    const healthColor = healthPercent > 0.5 ? '#0f0' :
                        healthPercent > 0.25 ? '#ff0' : '#f00';

    ctx.fillStyle = healthColor;
    ctx.fillRect(x + 2, y + 2, (width - 4) * healthPercent, height - 4);

    // Çerçeve
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Yazı
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`HP: ${Math.floor(player.health)}/${player.maxHealth}`, x + 5, y + 15);
}

/**
 * Boss HP bar
 */
function renderBossHealthBar(ctx) {
    const boss = game.currentBoss;
    if (!boss) return;

    const x = SCREEN.WIDTH / 2 - 150;
    const y = 50;
    const width = 300;
    const height = 25;

    // Boss adı
    ctx.fillStyle = '#f00';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.type.toUpperCase(), SCREEN.WIDTH / 2, y - 10);

    // Faz göstergesi
    ctx.fillStyle = '#ff0';
    ctx.font = '12px monospace';
    ctx.fillText(`Phase ${boss.phase}/${boss.maxPhases}`, SCREEN.WIDTH / 2, y - 25);

    // HP bar arka planı
    ctx.fillStyle = '#330000';
    ctx.fillRect(x, y, width, height);

    // HP
    const healthPercent = Math.max(0, boss.health / boss.maxHealth);
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#ff4400');
    gradient.addColorStop(1, '#ff0000');

    ctx.fillStyle = gradient;
    ctx.fillRect(x + 2, y + 2, (width - 4) * healthPercent, height - 4);

    // Parlama efekti
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x + 2, y + 2, (width - 4) * healthPercent, (height - 4) / 2);

    // Çerçeve
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    // HP değeri
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${Math.floor(boss.health)} / ${boss.maxHealth}`, SCREEN.WIDTH / 2, y + 18);

    ctx.textAlign = 'left';
}

/**
 * Aktif perkler göster
 */
function renderActivePerks(ctx, player) {
    const perks = getActivePerks(player);
    if (!perks || perks.length === 0) return;

    const startX = 20;
    const startY = SCREEN.HEIGHT - 60;
    const iconSize = 20;
    const spacing = 25;

    ctx.font = '14px monospace';

    perks.forEach((perk, i) => {
        const x = startX + i * spacing;
        const y = startY;

        // Icon arka planı
        ctx.fillStyle = perk.color || '#444';
        ctx.fillRect(x, y, iconSize, iconSize);

        // Stack sayısı
        if (perk.stacks > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`x${perk.stacks}`, x + 2, y + iconSize - 2);
        }

        // Çerçeve
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, iconSize, iconSize);
    });
}

/**
 * Mermi göstergesi
 */
function renderAmmoDisplay(ctx) {
    const weapon = getCurrentWeapon();
    const x = SCREEN.WIDTH - 170;
    const y = SCREEN.HEIGHT - 30;

    // Silah adı
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(weapon.name, SCREEN.WIDTH - 20, y);

    // Mermi
    const ammoText = weapon.ammo === Infinity ? '∞' : weapon.ammo.toString();
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = weapon.ammo < 10 && weapon.ammo !== Infinity ? '#f00' : '#ff0';
    ctx.fillText(ammoText, SCREEN.WIDTH - 20, y + 20);

    ctx.textAlign = 'left';
}

/**
 * Skor ve level göster
 */
function renderScore(ctx) {
    const score = game.score || 0;
    const level = game.level || 1;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${level}  |  SCORE: ${score}`, SCREEN.WIDTH / 2, 25);
    ctx.textAlign = 'left';
}

/**
 * Crosshair
 */
function renderCrosshair(ctx) {
    const cx = SCREEN.WIDTH / 2;
    const cy = SCREEN.HEIGHT / 2;
    const size = 8;
    const gap = 4;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    // Dört çizgi
    ctx.beginPath();
    // Üst
    ctx.moveTo(cx, cy - gap);
    ctx.lineTo(cx, cy - gap - size);
    // Alt
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + gap + size);
    // Sol
    ctx.moveTo(cx - gap, cy);
    ctx.lineTo(cx - gap - size, cy);
    // Sağ
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + gap + size, cy);
    ctx.stroke();

    // Merkez nokta
    ctx.fillStyle = '#f00';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

/**
 * Hasar aldığında kırmızı flash
 */
function renderDamageFlash(ctx) {
    const flash = game.damageFlash;
    if (!flash) return;

    // Yeni sistem: { time, intensity }
    if (typeof flash === 'object') {
        if (flash.time <= 0) return;
        ctx.fillStyle = `rgba(255, 0, 0, ${flash.intensity * 0.4})`;
        ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
    } else {
        // Eski sistem (geriye uyumluluk)
        if (flash <= 0) return;
        ctx.fillStyle = `rgba(255, 0, 0, ${flash * 0.4})`;
        ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
        game.damageFlash *= 0.9;
    }
}

/**
 * Game Over ekranı
 */
function renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);

    ctx.fillStyle = '#f00';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2);

    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText(`Final Score: ${game.score || 0}`, SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 40);
    ctx.fillText(`Level Reached: ${game.level || 1}`, SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 65);
    ctx.fillText('Press R to restart', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 100);

    ctx.textAlign = 'left';
}

/**
 * HUD'ı başlat
 */
export function initHud() {
    debugElement = document.getElementById('debug-info');
}

/**
 * Damage numbers temizle
 */
export function clearDamageNumbers() {
    damageNumbers.length = 0;
}
