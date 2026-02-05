// WeaponRenderer - ekranda silah görseli

import { SCREEN } from '../core/config.js';
import { getCurrentWeapon } from '../player/weapon.js';

/**
 * Silahı ekrana çiz
 */
export function renderWeapon(ctx) {
    const weapon = getCurrentWeapon();

    // Silah pozisyonu (ekranın alt ortası)
    const baseX = SCREEN.WIDTH / 2;
    const baseY = SCREEN.HEIGHT - 20;

    // Bob efekti (yürürken sallanma)
    const bobX = Math.sin(weapon.bob) * 5;
    const bobY = Math.abs(Math.cos(weapon.bob * 2)) * 3;

    // Kick efekti (ateş ederken geri tepme)
    const kickY = weapon.kick * 30;

    const x = baseX + bobX;
    const y = baseY + bobY + kickY;

    // Muzzle flash
    if (weapon.muzzleFlash > 0.1) {
        renderMuzzleFlash(ctx, x, y - 60, weapon.muzzleFlash);
    }

    // Silahı çiz (silah tipine göre)
    switch (weapon.id) {
        case 'pistol':
            renderPistol(ctx, x, y);
            break;
        case 'shotgun':
            renderShotgun(ctx, x, y);
            break;
        case 'smg':
            renderSMG(ctx, x, y);
            break;
        case 'machinegun':
            renderMachinegun(ctx, x, y);
            break;
        case 'rocket':
            renderRocketLauncher(ctx, x, y);
            break;
        case 'plasma':
            renderPlasmaRifle(ctx, x, y);
            break;
        case 'railgun':
            renderRailgun(ctx, x, y);
            break;
    }

    // Crosshair
    renderCrosshair(ctx);
}

/**
 * Pistol çiz
 */
function renderPistol(ctx, x, y) {
    // Gövde
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 8, y - 40, 16, 45);

    // Namlu
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 4, y - 60, 8, 25);

    // Kabza
    ctx.fillStyle = '#553322';
    ctx.fillRect(x - 6, y, 12, 25);

    // Tetik koruma
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(x, y + 5, 8, 0, Math.PI);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#666';
    ctx.fillRect(x - 6, y - 38, 3, 40);
}

/**
 * Shotgun çiz
 */
function renderShotgun(ctx, x, y) {
    // Çift namlu
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 12, y - 80, 8, 60);
    ctx.fillRect(x + 4, y - 80, 8, 60);

    // Gövde
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 15, y - 25, 30, 30);

    // Kundak
    ctx.fillStyle = '#664422';
    ctx.fillRect(x - 10, y, 20, 30);

    // Pompa
    ctx.fillStyle = '#553311';
    ctx.fillRect(x - 8, y - 50, 16, 15);

    // Highlight
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 10, y - 78, 3, 55);
    ctx.fillRect(x + 7, y - 78, 3, 55);
}

/**
 * Machine gun çiz
 */
function renderMachinegun(ctx, x, y) {
    // Uzun namlu
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 5, y - 90, 10, 70);

    // Gövde
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 18, y - 25, 36, 28);

    // Şarjör
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 5, y - 5, 10, 35);

    // Kabza
    ctx.fillStyle = '#553322';
    ctx.fillRect(x + 8, y - 10, 12, 30);

    // Tutamak (ön)
    ctx.fillStyle = '#553322';
    ctx.fillRect(x - 15, y - 50, 8, 20);

    // Highlight
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 3, y - 88, 2, 65);
}

/**
 * SMG çiz
 */
function renderSMG(ctx, x, y) {
    // Kısa namlu
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 4, y - 65, 8, 45);

    // Gövde
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 12, y - 25, 24, 25);

    // Şarjör (uzun)
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 4, y - 5, 8, 40);

    // Kabza
    ctx.fillStyle = '#553322';
    ctx.fillRect(x + 5, y - 15, 10, 25);

    // Ön tutamak
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 10, y - 45, 6, 15);

    // Highlight
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 2, y - 63, 2, 40);
}

/**
 * Rocket Launcher çiz
 */
function renderRocketLauncher(ctx, x, y) {
    // Ana tüp (geniş)
    ctx.fillStyle = '#445544';
    ctx.fillRect(x - 15, y - 85, 30, 65);

    // Namlu ağzı (koyu)
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 12, y - 90, 24, 10);

    // Arka kısım
    ctx.fillStyle = '#334433';
    ctx.fillRect(x - 12, y - 25, 24, 15);

    // Kabza
    ctx.fillStyle = '#553322';
    ctx.fillRect(x + 10, y - 35, 10, 35);

    // Nişangah
    ctx.fillStyle = '#666';
    ctx.fillRect(x - 3, y - 95, 6, 8);

    // Tetik koruma
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(x + 5, y - 15, 6, 0, Math.PI);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#556655';
    ctx.fillRect(x - 13, y - 82, 3, 55);
}

/**
 * Plasma Rifle çiz
 */
function renderPlasmaRifle(ctx, x, y) {
    // Enerji hücresi (parlak mavi)
    ctx.fillStyle = '#006688';
    ctx.fillRect(x - 8, y - 40, 16, 25);

    // Enerji glow
    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.fillRect(x - 6, y - 38, 12, 21);

    // Namlu (futuristik)
    ctx.fillStyle = '#445566';
    ctx.fillRect(x - 6, y - 75, 12, 40);

    // Namlu ucu (enerji)
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(x - 4, y - 80, 8, 8);

    // Gövde
    ctx.fillStyle = '#334455';
    ctx.fillRect(x - 14, y - 20, 28, 22);

    // Kabza
    ctx.fillStyle = '#445566';
    ctx.fillRect(x + 6, y - 10, 10, 28);

    // Ön tutamak
    ctx.fillStyle = '#445566';
    ctx.fillRect(x - 12, y - 55, 6, 18);

    // Parlama efekti
    ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y - 76, 15, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Railgun çiz
 */
function renderRailgun(ctx, x, y) {
    // Çok uzun namlu
    ctx.fillStyle = '#333344';
    ctx.fillRect(x - 4, y - 100, 8, 80);

    // Enerji rayları (yanlarında)
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(x - 8, y - 95, 2, 70);
    ctx.fillRect(x + 6, y - 95, 2, 70);

    // Gövde
    ctx.fillStyle = '#444455';
    ctx.fillRect(x - 12, y - 25, 24, 25);

    // Enerji çekirdeği
    ctx.fillStyle = '#880088';
    ctx.fillRect(x - 6, y - 35, 12, 15);

    // Enerji glow
    ctx.fillStyle = 'rgba(255, 0, 255, 0.4)';
    ctx.fillRect(x - 4, y - 33, 8, 11);

    // Kabza
    ctx.fillStyle = '#334444';
    ctx.fillRect(x + 6, y - 15, 10, 30);

    // Namlu ucu (şarj)
    ctx.fillStyle = '#ff44ff';
    ctx.beginPath();
    ctx.arc(x, y - 100, 6, 0, Math.PI * 2);
    ctx.fill();

    // Parlama
    ctx.fillStyle = 'rgba(255, 0, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(x, y - 100, 20, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#555566';
    ctx.fillRect(x - 2, y - 98, 2, 75);
}

/**
 * Muzzle flash efekti
 */
function renderMuzzleFlash(ctx, x, y, intensity) {
    const size = 20 + intensity * 30;

    // Dış glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, `rgba(255, 200, 50, ${intensity})`);
    gradient.addColorStop(0.3, `rgba(255, 100, 0, ${intensity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // İç parlak nokta
    ctx.fillStyle = `rgba(255, 255, 200, ${intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Crosshair (nişangah)
 */
function renderCrosshair(ctx) {
    const cx = SCREEN.WIDTH / 2;
    const cy = SCREEN.HEIGHT / 2;
    const size = 10;
    const gap = 4;

    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;

    // Üst
    ctx.beginPath();
    ctx.moveTo(cx, cy - gap);
    ctx.lineTo(cx, cy - gap - size);
    ctx.stroke();

    // Alt
    ctx.beginPath();
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + gap + size);
    ctx.stroke();

    // Sol
    ctx.beginPath();
    ctx.moveTo(cx - gap, cy);
    ctx.lineTo(cx - gap - size, cy);
    ctx.stroke();

    // Sağ
    ctx.beginPath();
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + gap + size, cy);
    ctx.stroke();

    // Ortadaki nokta
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
}
