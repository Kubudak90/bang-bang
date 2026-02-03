// WeaponRenderer - ekranda silah görseli (Geliştirilmiş versiyon)
// Detaylı 3D görünümlü silahlar, animasyonlar ve efektler

import { SCREEN } from '../core/config.js';
import { getCurrentWeapon } from '../player/weapon.js';
import { game } from '../core/game.js';

// Animasyon state'leri
let reloadProgress = 0;
let switchProgress = 0;
let lastWeaponId = 'pistol';

// El pozisyonu (perspektif için)
const HAND_OFFSET_X = 80;
const HAND_OFFSET_Y = 40;

/**
 * Silahı ekrana çiz
 */
export function renderWeapon(ctx) {
    const weapon = getCurrentWeapon();

    // Silah değişim animasyonu
    if (weapon.id !== lastWeaponId) {
        switchProgress = 1;
        lastWeaponId = weapon.id;
    }
    switchProgress *= 0.85;

    // Silah pozisyonu (ekranın alt sağı - FPS perspektifi)
    const baseX = SCREEN.WIDTH / 2 + HAND_OFFSET_X;
    const baseY = SCREEN.HEIGHT + HAND_OFFSET_Y;

    // Bob efekti (yürürken sallanma) - daha organik
    const bobX = Math.sin(weapon.bob) * 8;
    const bobY = Math.abs(Math.cos(weapon.bob * 2)) * 5;

    // Kick efekti (ateş ederken geri tepme) - daha güçlü
    const kickY = weapon.kick * 50;
    const kickRot = weapon.kick * 0.15; // Hafif rotasyon

    // Silah değişim offset
    const switchOffset = switchProgress * 100;

    // İdle sway (nefes alma efekti)
    const time = performance.now() / 1000;
    const swayX = Math.sin(time * 1.5) * 2;
    const swayY = Math.sin(time * 2.3) * 1.5;

    const x = baseX + bobX + swayX;
    const y = baseY + bobY + kickY + switchOffset + swayY;

    ctx.save();

    // Rotasyon (ateş ederken)
    if (kickRot > 0.01) {
        ctx.translate(x, y);
        ctx.rotate(-kickRot);
        ctx.translate(-x, -y);
    }

    // Muzzle flash (namlu ateşi)
    if (weapon.muzzleFlash > 0.1) {
        renderMuzzleFlash(ctx, x - 30, y - 100, weapon.muzzleFlash, weapon.id);
    }

    // Silahı çiz (silah tipine göre)
    switch (weapon.id) {
        case 'pistol':
            renderPistolDetailed(ctx, x, y, weapon);
            break;
        case 'shotgun':
            renderShotgunDetailed(ctx, x, y, weapon);
            break;
        case 'machinegun':
            renderMachinegunDetailed(ctx, x, y, weapon);
            break;
    }

    ctx.restore();

    // Crosshair
    renderCrosshair(ctx, weapon);
}

/**
 * Detaylı Pistol çiz
 */
function renderPistolDetailed(ctx, x, y, weapon) {
    // Eller (ten rengi)
    renderHand(ctx, x - 5, y - 30, 0.9);

    // Namlu highlight gölgesi
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 38, y - 95, 16, 45);

    // Namlu (koyu metal)
    const barrelGrad = ctx.createLinearGradient(x - 35, 0, x - 25, 0);
    barrelGrad.addColorStop(0, '#2a2a2a');
    barrelGrad.addColorStop(0.5, '#4a4a4a');
    barrelGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(x - 35, y - 90, 12, 40);

    // Namlu iç
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - 29, y - 92, 4, 0, Math.PI * 2);
    ctx.fill();

    // Sürgü (slide)
    const slideGrad = ctx.createLinearGradient(x - 45, 0, x - 10, 0);
    slideGrad.addColorStop(0, '#3a3a3a');
    slideGrad.addColorStop(0.3, '#5a5a5a');
    slideGrad.addColorStop(0.7, '#4a4a4a');
    slideGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = slideGrad;
    ctx.fillRect(x - 45, y - 55, 35, 30);

    // Sürgü detayları
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 43, y - 52, 2, 24); // Sol çizgi
    ctx.fillRect(x - 38, y - 52, 1, 24);
    ctx.fillRect(x - 33, y - 52, 1, 24);

    // Ejeksiyon portu
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 40, y - 48, 8, 12);

    // Gövde (frame)
    const frameGrad = ctx.createLinearGradient(x - 45, 0, x - 5, 0);
    frameGrad.addColorStop(0, '#3a3a3a');
    frameGrad.addColorStop(0.5, '#4a4a4a');
    frameGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = frameGrad;
    ctx.fillRect(x - 45, y - 25, 40, 35);

    // Kabza (grip) - ahşap doku
    const gripGrad = ctx.createLinearGradient(x - 40, 0, x - 10, 0);
    gripGrad.addColorStop(0, '#4a3020');
    gripGrad.addColorStop(0.3, '#6a4a30');
    gripGrad.addColorStop(0.7, '#5a3a25');
    gripGrad.addColorStop(1, '#3a2515');
    ctx.fillStyle = gripGrad;
    ctx.fillRect(x - 40, y + 5, 30, 45);

    // Kabza texture çizgileri
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 38, y + 10 + i * 5);
        ctx.lineTo(x - 12, y + 10 + i * 5);
        ctx.stroke();
    }

    // Tetik koruma
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(x - 35, y - 5);
    ctx.quadraticCurveTo(x - 30, y + 15, x - 15, y + 5);
    ctx.lineTo(x - 15, y - 5);
    ctx.fill();

    // Tetik
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 28, y - 2, 4, 12);

    // Nişangah (arka)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 42, y - 58, 4, 6);
    ctx.fillRect(x - 18, y - 58, 4, 6);

    // Şarjör tabanı
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 38, y + 45, 26, 8);
}

/**
 * Detaylı Shotgun çiz
 */
function renderShotgunDetailed(ctx, x, y, weapon) {
    // Eller
    renderHand(ctx, x - 30, y - 50, 0.85); // Ön el (pompa)
    renderHand(ctx, x + 5, y - 20, 0.95);  // Arka el (kabza)

    // Çift namlu gölge
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 55, y - 130, 22, 80);

    // Sol namlu
    const barrelGrad = ctx.createLinearGradient(x - 52, 0, x - 42, 0);
    barrelGrad.addColorStop(0, '#2a2a2a');
    barrelGrad.addColorStop(0.5, '#4a4a4a');
    barrelGrad.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(x - 52, y - 125, 10, 75);

    // Sağ namlu
    ctx.fillRect(x - 40, y - 125, 10, 75);

    // Namlu iç (karanlık)
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(x - 47, y - 128, 4, 0, Math.PI * 2);
    ctx.arc(x - 35, y - 128, 4, 0, Math.PI * 2);
    ctx.fill();

    // Namlu bağlantısı
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x - 52, y - 55, 22, 8);

    // Pompa mekanizması
    const pumpY = y - 70 + weapon.kick * 20; // Ateş ederken geri
    const pumpGrad = ctx.createLinearGradient(0, pumpY, 0, pumpY + 25);
    pumpGrad.addColorStop(0, '#5a4530');
    pumpGrad.addColorStop(0.5, '#7a6550');
    pumpGrad.addColorStop(1, '#4a3520');
    ctx.fillStyle = pumpGrad;
    ctx.fillRect(x - 55, pumpY, 28, 25);

    // Pompa çizgileri
    ctx.strokeStyle = '#3a2515';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 53, pumpY + 5 + i * 5);
        ctx.lineTo(x - 29, pumpY + 5 + i * 5);
        ctx.stroke();
    }

    // Receiver (alıcı)
    const receiverGrad = ctx.createLinearGradient(x - 55, 0, x - 20, 0);
    receiverGrad.addColorStop(0, '#3a3a3a');
    receiverGrad.addColorStop(0.5, '#5a5a5a');
    receiverGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = receiverGrad;
    ctx.fillRect(x - 55, y - 45, 45, 35);

    // Loading port
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 45, y - 35, 20, 15);

    // Kundak (stock)
    const stockGrad = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
    stockGrad.addColorStop(0, '#5a4030');
    stockGrad.addColorStop(0.3, '#7a6050');
    stockGrad.addColorStop(0.7, '#6a5040');
    stockGrad.addColorStop(1, '#4a3020');
    ctx.fillStyle = stockGrad;

    ctx.beginPath();
    ctx.moveTo(x - 15, y - 15);
    ctx.lineTo(x + 30, y + 10);
    ctx.lineTo(x + 35, y + 50);
    ctx.lineTo(x + 10, y + 60);
    ctx.lineTo(x - 15, y + 45);
    ctx.closePath();
    ctx.fill();

    // Kundak texture
    ctx.strokeStyle = '#3a2515';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 10, y - 5 + i * 10);
        ctx.lineTo(x + 25, y + 15 + i * 8);
        ctx.stroke();
    }

    // Kabza (pistol grip)
    ctx.fillStyle = stockGrad;
    ctx.fillRect(x - 10, y - 10, 18, 50);

    // Tetik koruma
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(x - 25, y - 5, 12, 8, 0, 0, Math.PI);
    ctx.fill();

    // Tetik
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 28, y - 12, 4, 10);
}

/**
 * Detaylı Machine Gun çiz
 */
function renderMachinegunDetailed(ctx, x, y, weapon) {
    // Eller
    renderHand(ctx, x - 50, y - 60, 0.8);  // Ön tutamak
    renderHand(ctx, x + 10, y - 25, 0.95); // Kabza

    // Uzun namlu gölge
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 58, y - 145, 18, 95);

    // Namlu
    const barrelGrad = ctx.createLinearGradient(x - 55, 0, x - 42, 0);
    barrelGrad.addColorStop(0, '#2a2a2a');
    barrelGrad.addColorStop(0.4, '#4a4a4a');
    barrelGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(x - 55, y - 140, 14, 90);

    // Namlu iç
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(x - 48, y - 143, 5, 0, Math.PI * 2);
    ctx.fill();

    // Namlu soğutma delikleri
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x - 48, y - 130 + i * 15, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Flash hider
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x - 57, y - 150, 18, 12);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 55, y - 148, 4, 8);
    ctx.fillRect(x - 45, y - 148, 4, 8);

    // Upper receiver
    const upperGrad = ctx.createLinearGradient(x - 60, 0, x - 15, 0);
    upperGrad.addColorStop(0, '#3a3a3a');
    upperGrad.addColorStop(0.5, '#5a5a5a');
    upperGrad.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = upperGrad;
    ctx.fillRect(x - 60, y - 55, 55, 28);

    // Carry handle / Rail
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x - 55, y - 65, 40, 12);

    // Ejeksiyon portu
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 45, y - 48, 15, 12);

    // Charging handle
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 55, y - 52, 8, 6);

    // Lower receiver
    const lowerGrad = ctx.createLinearGradient(x - 60, 0, x - 10, 0);
    lowerGrad.addColorStop(0, '#3a3a3a');
    lowerGrad.addColorStop(0.5, '#4a4a4a');
    lowerGrad.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = lowerGrad;
    ctx.fillRect(x - 60, y - 27, 60, 30);

    // Şarjör (magazine)
    const magBob = Math.sin(performance.now() / 500) * 0.5; // Hafif sallanma
    const magGrad = ctx.createLinearGradient(x - 45, 0, x - 25, 0);
    magGrad.addColorStop(0, '#4a4a4a');
    magGrad.addColorStop(0.5, '#5a5a5a');
    magGrad.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = magGrad;
    ctx.fillRect(x - 45 + magBob, y - 5, 18, 55);

    // Şarjör çizgileri
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 43, y + i * 6);
        ctx.lineTo(x - 29, y + i * 6);
        ctx.stroke();
    }

    // Şarjör tabanı
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 46, y + 48, 20, 8);

    // Ön tutamak (foregrip)
    const fgGrad = ctx.createLinearGradient(x - 55, 0, x - 40, 0);
    fgGrad.addColorStop(0, '#4a3525');
    fgGrad.addColorStop(0.5, '#6a5545');
    fgGrad.addColorStop(1, '#3a2515');
    ctx.fillStyle = fgGrad;
    ctx.fillRect(x - 55, y - 75, 14, 30);

    // Tutamak texture
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 53, y - 70 + i * 5);
        ctx.lineTo(x - 43, y - 70 + i * 5);
        ctx.stroke();
    }

    // Kabza (pistol grip)
    const gripGrad = ctx.createLinearGradient(x, 0, x + 25, 0);
    gripGrad.addColorStop(0, '#4a3525');
    gripGrad.addColorStop(0.5, '#6a5545');
    gripGrad.addColorStop(1, '#3a2515');
    ctx.fillStyle = gripGrad;
    ctx.fillRect(x, y - 20, 20, 50);

    // Tetik koruma
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 10);
    ctx.quadraticCurveTo(x - 10, y + 10, x + 5, y - 5);
    ctx.lineTo(x + 5, y - 15);
    ctx.lineTo(x - 20, y - 15);
    ctx.fill();

    // Tetik
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 12, y - 15, 4, 12);

    // Kundak (collapsible stock)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 15, y - 25, 40, 15);

    // Buffer tube
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.ellipse(x + 55, y - 17, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * El çiz (ten rengi)
 */
function renderHand(ctx, x, y, scale = 1) {
    const s = scale;

    // El gölgesi
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 3, 18 * s, 25 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // El ana
    const handGrad = ctx.createRadialGradient(x, y - 5, 0, x, y, 30 * s);
    handGrad.addColorStop(0, '#f5c9a8');
    handGrad.addColorStop(0.7, '#d4a574');
    handGrad.addColorStop(1, '#b08050');
    ctx.fillStyle = handGrad;

    ctx.beginPath();
    ctx.ellipse(x, y, 16 * s, 22 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Parmaklar (basitleştirilmiş)
    ctx.fillStyle = '#e8b89d';
    for (let i = 0; i < 4; i++) {
        const fingerX = x - 10 * s + i * 6 * s;
        const fingerY = y - 20 * s;
        ctx.beginPath();
        ctx.ellipse(fingerX, fingerY, 4 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Başparmak
    ctx.beginPath();
    ctx.ellipse(x + 15 * s, y - 5 * s, 5 * s, 12 * s, 0.5, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Geliştirilmiş Muzzle flash efekti
 */
function renderMuzzleFlash(ctx, x, y, intensity, weaponType) {
    const baseSize = weaponType === 'shotgun' ? 40 : (weaponType === 'machinegun' ? 30 : 25);
    const size = baseSize + intensity * 40;

    // Dış glow (büyük)
    const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
    outerGlow.addColorStop(0, `rgba(255, 150, 50, ${intensity * 0.3})`);
    outerGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Ana flash
    const mainFlash = ctx.createRadialGradient(x, y, 0, x, y, size);
    mainFlash.addColorStop(0, `rgba(255, 255, 200, ${intensity})`);
    mainFlash.addColorStop(0.2, `rgba(255, 200, 100, ${intensity * 0.9})`);
    mainFlash.addColorStop(0.5, `rgba(255, 100, 0, ${intensity * 0.6})`);
    mainFlash.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = mainFlash;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Işık ışınları (star pattern)
    if (intensity > 0.5) {
        ctx.strokeStyle = `rgba(255, 255, 200, ${intensity * 0.5})`;
        ctx.lineWidth = 2;
        const rays = weaponType === 'shotgun' ? 8 : 4;
        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + performance.now() / 100;
            const rayLength = size * (0.8 + Math.random() * 0.4);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(angle) * rayLength,
                y + Math.sin(angle) * rayLength
            );
            ctx.stroke();
        }
    }

    // Merkez parlaklık
    ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Geliştirilmiş Crosshair (nişangah)
 */
function renderCrosshair(ctx, weapon) {
    const cx = SCREEN.WIDTH / 2;
    const cy = SCREEN.HEIGHT / 2;

    // Spread'e göre crosshair boyutu
    const baseSize = 8;
    const spreadBonus = weapon.spread * 50;
    const kickBonus = weapon.kick * 15;
    const size = baseSize + spreadBonus + kickBonus;
    const gap = 4 + kickBonus;

    // Dış glow
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 8;

    // Dinamik renk (ateş ederken kırmızıya döner)
    const r = Math.floor(weapon.kick * 255);
    const g = Math.floor(255 - weapon.kick * 100);
    ctx.strokeStyle = `rgb(${r}, ${g}, 50)`;
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

    // Köşe işaretleri (shotgun için)
    if (weapon.id === 'shotgun') {
        const cornerDist = gap + size + 5;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${r}, ${g}, 50, 0.5)`;

        // Sol üst
        ctx.beginPath();
        ctx.moveTo(cx - cornerDist, cy - cornerDist + 5);
        ctx.lineTo(cx - cornerDist, cy - cornerDist);
        ctx.lineTo(cx - cornerDist + 5, cy - cornerDist);
        ctx.stroke();

        // Sağ üst
        ctx.beginPath();
        ctx.moveTo(cx + cornerDist - 5, cy - cornerDist);
        ctx.lineTo(cx + cornerDist, cy - cornerDist);
        ctx.lineTo(cx + cornerDist, cy - cornerDist + 5);
        ctx.stroke();

        // Sol alt
        ctx.beginPath();
        ctx.moveTo(cx - cornerDist, cy + cornerDist - 5);
        ctx.lineTo(cx - cornerDist, cy + cornerDist);
        ctx.lineTo(cx - cornerDist + 5, cy + cornerDist);
        ctx.stroke();

        // Sağ alt
        ctx.beginPath();
        ctx.moveTo(cx + cornerDist - 5, cy + cornerDist);
        ctx.lineTo(cx + cornerDist, cy + cornerDist);
        ctx.lineTo(cx + cornerDist, cy + cornerDist - 5);
        ctx.stroke();
    }

    // Ortadaki nokta
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgb(${r}, ${g}, 50)`;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
}
