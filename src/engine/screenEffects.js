// ScreenEffects - Ekran efektleri sistemi
// Hasar, düşük can, screen shake, speed lines vb.

import { SCREEN } from '../core/config.js';
import { game } from '../core/game.js';

// Efekt state'leri
const effects = {
    // Screen shake
    shake: {
        intensity: 0,
        duration: 0,
        frequency: 30,
        offsetX: 0,
        offsetY: 0
    },

    // Damage vignette (kırmızı kenarlar)
    damageVignette: {
        intensity: 0,
        targetIntensity: 0,
        color: { r: 255, g: 0, b: 0 }
    },

    // Low health pulse
    lowHealthPulse: {
        active: false,
        phase: 0,
        threshold: 30  // HP yüzdesi
    },

    // Speed lines (hızlı hareket)
    speedLines: {
        intensity: 0,
        lines: []
    },

    // Flash (beyaz patlama)
    flash: {
        intensity: 0,
        color: { r: 255, g: 255, b: 255 }
    },

    // Chromatic aberration (renk kayması)
    chromaticAberration: {
        intensity: 0
    },

    // Blur (bulanıklık) - basitleştirilmiş
    blur: {
        intensity: 0
    },

    // Scan lines (retro efekt)
    scanLines: {
        enabled: true,
        opacity: 0.03
    },

    // Film grain (gürültü)
    filmGrain: {
        enabled: true,
        intensity: 0.02
    },

    // Vignette (sürekli kenar karartma)
    vignette: {
        enabled: true,
        intensity: 0.4
    }
};

// Speed lines için pre-allocated array
const MAX_SPEED_LINES = 30;
for (let i = 0; i < MAX_SPEED_LINES; i++) {
    effects.speedLines.lines.push({
        active: false,
        x: 0,
        y: 0,
        length: 0,
        angle: 0,
        alpha: 0
    });
}

/**
 * Tüm efektleri güncelle
 */
export function updateScreenEffects(deltaTime, player) {
    // Screen shake güncelle
    if (effects.shake.duration > 0) {
        effects.shake.duration -= deltaTime;
        const shakeAmount = effects.shake.intensity * (effects.shake.duration / 0.3);
        effects.shake.offsetX = Math.sin(performance.now() * effects.shake.frequency) * shakeAmount;
        effects.shake.offsetY = Math.cos(performance.now() * effects.shake.frequency * 1.3) * shakeAmount;
    } else {
        effects.shake.offsetX *= 0.8;
        effects.shake.offsetY *= 0.8;
    }

    // Damage vignette fade
    effects.damageVignette.intensity += (effects.damageVignette.targetIntensity - effects.damageVignette.intensity) * deltaTime * 8;
    effects.damageVignette.targetIntensity *= 0.95;

    // Low health pulse
    if (player) {
        const healthPercent = (player.health / player.maxHealth) * 100;
        effects.lowHealthPulse.active = healthPercent <= effects.lowHealthPulse.threshold && healthPercent > 0;

        if (effects.lowHealthPulse.active) {
            effects.lowHealthPulse.phase += deltaTime * 4;
        }
    }

    // Speed lines güncelle
    for (const line of effects.speedLines.lines) {
        if (line.active) {
            line.alpha -= deltaTime * 3;
            line.length += deltaTime * 200;
            if (line.alpha <= 0) {
                line.active = false;
            }
        }
    }
    effects.speedLines.intensity *= 0.95;

    // Flash fade
    effects.flash.intensity *= 0.9;

    // Chromatic aberration fade
    effects.chromaticAberration.intensity *= 0.95;

    // Blur fade
    effects.blur.intensity *= 0.95;
}

/**
 * Tüm efektleri render et (oyun renderından sonra çağrılır)
 */
export function renderScreenEffects(ctx) {
    const width = SCREEN.WIDTH;
    const height = SCREEN.HEIGHT;

    // Vignette (sürekli)
    if (effects.vignette.enabled) {
        renderVignette(ctx, width, height, effects.vignette.intensity, { r: 0, g: 0, b: 0 });
    }

    // Damage vignette
    if (effects.damageVignette.intensity > 0.01) {
        renderVignette(ctx, width, height, effects.damageVignette.intensity, effects.damageVignette.color);
    }

    // Low health pulse
    if (effects.lowHealthPulse.active) {
        const pulse = (Math.sin(effects.lowHealthPulse.phase) + 1) / 2;
        const intensity = 0.1 + pulse * 0.2;
        renderVignette(ctx, width, height, intensity, { r: 200, g: 0, b: 0 });

        // Nabız simgesi (kalp atışı çizgisi)
        renderHeartbeat(ctx, width, height, effects.lowHealthPulse.phase);
    }

    // Flash
    if (effects.flash.intensity > 0.01) {
        const { r, g, b } = effects.flash.color;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${effects.flash.intensity})`;
        ctx.fillRect(0, 0, width, height);
    }

    // Speed lines
    if (effects.speedLines.intensity > 0.01) {
        renderSpeedLines(ctx, width, height);
    }

    // Scan lines (retro)
    if (effects.scanLines.enabled) {
        renderScanLines(ctx, width, height);
    }

    // Film grain
    if (effects.filmGrain.enabled) {
        renderFilmGrain(ctx, width, height);
    }
}

/**
 * Vignette efekti render
 */
function renderVignette(ctx, width, height, intensity, color) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(width, height) * 0.7;

    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Kalp atışı çizgisi (düşük can uyarısı)
 */
function renderHeartbeat(ctx, width, height, phase) {
    const y = height - 30;
    const lineWidth = 150;
    const startX = 20;

    ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + Math.sin(phase) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, y);

    // Düz çizgi
    ctx.lineTo(startX + lineWidth * 0.3, y);

    // İlk spike
    ctx.lineTo(startX + lineWidth * 0.35, y - 5);
    ctx.lineTo(startX + lineWidth * 0.4, y + 20);
    ctx.lineTo(startX + lineWidth * 0.45, y - 25);
    ctx.lineTo(startX + lineWidth * 0.5, y);

    // Düz çizgi
    ctx.lineTo(startX + lineWidth * 0.6, y);

    // İkinci küçük spike
    ctx.lineTo(startX + lineWidth * 0.65, y - 8);
    ctx.lineTo(startX + lineWidth * 0.7, y);

    // Son düz çizgi
    ctx.lineTo(startX + lineWidth, y);

    ctx.stroke();
}

/**
 * Hız çizgileri render
 */
function renderSpeedLines(ctx, width, height) {
    const cx = width / 2;
    const cy = height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;

    for (const line of effects.speedLines.lines) {
        if (!line.active || line.alpha <= 0) continue;

        ctx.strokeStyle = `rgba(255, 255, 255, ${line.alpha * 0.5})`;
        ctx.beginPath();

        const endX = line.x + Math.cos(line.angle) * line.length;
        const endY = line.y + Math.sin(line.angle) * line.length;

        ctx.moveTo(line.x, line.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
}

/**
 * Scan lines (retro CRT efekti)
 */
function renderScanLines(ctx, width, height) {
    ctx.fillStyle = `rgba(0, 0, 0, ${effects.scanLines.opacity})`;

    for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1);
    }
}

/**
 * Film grain efekti
 */
function renderFilmGrain(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const intensity = effects.filmGrain.intensity * 50;

    // Performans için her 4. pixel'i değiştir
    for (let i = 0; i < data.length; i += 16) {
        const noise = (Math.random() - 0.5) * intensity;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }

    ctx.putImageData(imageData, 0, 0);
}

/**
 * Screen shake offset al (render için)
 */
export function getShakeOffset() {
    return {
        x: effects.shake.offsetX,
        y: effects.shake.offsetY
    };
}

// ============================================
// EFEKT TETİKLEME FONKSİYONLARI
// ============================================

/**
 * Screen shake tetikle
 */
export function triggerScreenShake(intensity = 10, duration = 0.2) {
    effects.shake.intensity = Math.max(effects.shake.intensity, intensity);
    effects.shake.duration = Math.max(effects.shake.duration, duration);
}

/**
 * Hasar aldığında çağrılır
 */
export function triggerDamageEffect(damage = 20) {
    // Vignette intensity hasara göre
    const intensity = Math.min(0.8, damage / 50);
    effects.damageVignette.targetIntensity = Math.max(effects.damageVignette.targetIntensity, intensity);

    // Screen shake
    triggerScreenShake(damage / 3, 0.15);
}

/**
 * Flash efekti (patlama, respawn vb.)
 */
export function triggerFlash(intensity = 1, color = { r: 255, g: 255, b: 255 }) {
    effects.flash.intensity = intensity;
    effects.flash.color = color;
}

/**
 * Hız çizgileri ekle (sprint, dash)
 */
export function addSpeedLines(count = 5) {
    effects.speedLines.intensity = 1;

    const cx = SCREEN.WIDTH / 2;
    const cy = SCREEN.HEIGHT / 2;

    for (let i = 0; i < count; i++) {
        // Boş line bul
        const line = effects.speedLines.lines.find(l => !l.active);
        if (!line) continue;

        // Kenardan merkeze doğru
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(SCREEN.WIDTH, SCREEN.HEIGHT) * 0.6;

        line.active = true;
        line.x = cx + Math.cos(angle) * dist;
        line.y = cy + Math.sin(angle) * dist;
        line.angle = angle + Math.PI; // Merkeze doğru
        line.length = 20 + Math.random() * 30;
        line.alpha = 0.5 + Math.random() * 0.5;
    }
}

/**
 * Chromatic aberration tetikle (hit efekti)
 */
export function triggerChromaticAberration(intensity = 1) {
    effects.chromaticAberration.intensity = Math.max(effects.chromaticAberration.intensity, intensity);
}

/**
 * Kill efekti (düşman öldüğünde)
 */
export function triggerKillEffect() {
    triggerFlash(0.3, { r: 255, g: 100, b: 100 });
    triggerScreenShake(3, 0.1);
}

/**
 * Ağır silah ateşi efekti
 */
export function triggerHeavyWeaponEffect() {
    triggerScreenShake(8, 0.15);
    addSpeedLines(3);
}

/**
 * Patlama efekti
 */
export function triggerExplosionEffect(distance = 5) {
    // Mesafeye göre efekt yoğunluğu
    const intensity = Math.max(0, 1 - distance / 10);

    triggerScreenShake(20 * intensity, 0.4);
    triggerFlash(0.5 * intensity, { r: 255, g: 200, b: 100 });
    triggerChromaticAberration(intensity);
}

/**
 * Retro efektleri aç/kapa
 */
export function toggleRetroEffects(enabled) {
    effects.scanLines.enabled = enabled;
    effects.filmGrain.enabled = enabled;
}

/**
 * Vignette aç/kapa
 */
export function toggleVignette(enabled) {
    effects.vignette.enabled = enabled;
}

/**
 * Efekt ayarlarını al (debug için)
 */
export function getEffectSettings() {
    return effects;
}

/**
 * Tüm efektleri sıfırla
 */
export function resetEffects() {
    effects.shake.intensity = 0;
    effects.shake.duration = 0;
    effects.shake.offsetX = 0;
    effects.shake.offsetY = 0;
    effects.damageVignette.intensity = 0;
    effects.damageVignette.targetIntensity = 0;
    effects.lowHealthPulse.phase = 0;
    effects.flash.intensity = 0;
    effects.chromaticAberration.intensity = 0;
    effects.blur.intensity = 0;

    for (const line of effects.speedLines.lines) {
        line.active = false;
    }
}
