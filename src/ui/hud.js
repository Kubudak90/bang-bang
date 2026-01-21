// HUD - ekran üstü bilgiler

import { SCREEN } from '../core/config.js';
import { game } from '../core/game.js';
import { radToDeg } from '../core/utils.js';
import { getCurrentWeapon } from '../player/weapon.js';

// DOM referansları (cache)
let debugElement = null;

/**
 * Debug bilgilerini güncelle
 */
export function updateDebugInfo(player) {
    if (!game.debug.showFps) return;

    // Lazy init
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
    // Sağlık barı
    renderHealthBar(ctx, player);

    // Silah ve mermi
    renderAmmoDisplay(ctx);

    // Skor
    renderScore(ctx);

    // Hasar flash efekti
    renderDamageFlash(ctx);

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
    const healthPercent = player.health / player.maxHealth;
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
    ctx.fillText(`HP: ${player.health}/${player.maxHealth}`, x + 5, y + 15);
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

    ctx.textAlign = 'left'; // Reset
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
 * Hasar aldığında kırmızı flash
 */
function renderDamageFlash(ctx) {
    if (!game.damageFlash || game.damageFlash <= 0) return;

    ctx.fillStyle = `rgba(255, 0, 0, ${game.damageFlash * 0.4})`;
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);

    game.damageFlash *= 0.9;
}

/**
 * Game Over ekranı
 */
function renderGameOver(ctx) {
    // Karartma
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);

    // Yazı
    ctx.fillStyle = '#f00';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2);

    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText(`Final Score: ${game.score || 0}`, SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 40);
    ctx.fillText('Press R to restart', SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 + 80);

    ctx.textAlign = 'left';
}

/**
 * HUD'ı başlat
 */
export function initHud() {
    debugElement = document.getElementById('debug-info');
}
