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
        case 'machinegun':
            renderMachinegun(ctx, x, y);
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
