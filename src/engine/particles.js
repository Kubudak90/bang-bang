// Particles - Parçacık sistemi
// Muzzle flash, kan, patlama, kovan, mermi izi efektleri

import { SCREEN } from '../core/config.js';
import { game } from '../core/game.js';

// Parçacık havuzu (object pooling - performans için)
const MAX_PARTICLES = 500;
const particlePool = [];
const activeParticles = [];

// Parçacık tipleri
export const PARTICLE_TYPES = {
    SPARK: 'spark',           // Kıvılcım
    BLOOD: 'blood',           // Kan
    SMOKE: 'smoke',           // Duman
    SHELL: 'shell',           // Kovan
    DEBRIS: 'debris',         // Moloz
    MUZZLE: 'muzzle',         // Namlu ateşi
    TRAIL: 'trail',           // Mermi izi
    EXPLOSION: 'explosion',   // Patlama
    DUST: 'dust',             // Toz
    GLOW: 'glow'              // Parlama
};

/**
 * Parçacık class'ı
 */
class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.active = false;
        this.type = PARTICLE_TYPES.SPARK;

        // 3D dünya pozisyonu
        this.x = 0;
        this.y = 0;
        this.z = 0;  // Yükseklik (0 = zemin, 1 = göz seviyesi)

        // Hız
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;

        // Görsel
        this.size = 5;
        this.color = { r: 255, g: 255, b: 255 };
        this.alpha = 1;

        // Yaşam
        this.life = 1;
        this.maxLife = 1;
        this.decay = 0.02;

        // Fizik
        this.gravity = 0;
        this.friction = 0.98;
        this.bounce = 0;

        // Ekstra
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.scale = 1;
        this.scaleDecay = 0;

        // 2D ekran efektleri için (UI parçacıkları)
        this.screenSpace = false;
        this.screenX = 0;
        this.screenY = 0;
    }

    update(deltaTime) {
        if (!this.active) return;

        // Yaşam azalt
        this.life -= this.decay * deltaTime * 60;

        if (this.life <= 0) {
            this.active = false;
            return;
        }

        // Fizik
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vz -= this.gravity * deltaTime;

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.z += this.vz * deltaTime;

        // Zemin çarpması
        if (this.z < 0) {
            this.z = 0;
            this.vz *= -this.bounce;
            this.vx *= 0.7;
            this.vy *= 0.7;

            if (Math.abs(this.vz) < 0.1) {
                this.vz = 0;
            }
        }

        // Alpha fade
        this.alpha = this.life / this.maxLife;

        // Scale decay
        if (this.scaleDecay > 0) {
            this.scale -= this.scaleDecay * deltaTime;
            if (this.scale < 0) this.scale = 0;
        }

        // Rotation
        this.rotation += this.rotationSpeed * deltaTime;

        // Screen space güncelleme
        if (this.screenSpace) {
            this.screenX += this.vx * deltaTime;
            this.screenY += this.vy * deltaTime;
            this.vy += this.gravity * deltaTime * 100;
        }
    }
}

/**
 * Parçacık havuzunu başlat
 */
export function initParticles() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
        particlePool.push(new Particle());
    }
    console.log(`✨ Parçacık sistemi başlatıldı (${MAX_PARTICLES} parçacık havuzu)`);
}

/**
 * Havuzdan parçacık al
 */
function getParticle() {
    // Önce havuzdan inaktif parçacık bul
    for (const p of particlePool) {
        if (!p.active) {
            p.reset();
            p.active = true;
            if (!activeParticles.includes(p)) {
                activeParticles.push(p);
            }
            return p;
        }
    }

    // Havuz dolu - en eski aktif parçacığı geri dönüştür
    if (activeParticles.length > 0) {
        const oldest = activeParticles.shift();
        oldest.reset();
        oldest.active = true;
        activeParticles.push(oldest);
        return oldest;
    }

    return null;
}

/**
 * Tüm parçacıkları güncelle
 */
export function updateParticles(deltaTime) {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.update(deltaTime);

        if (!p.active) {
            activeParticles.splice(i, 1);
        }
    }
}

/**
 * Dünya parçacıklarını render et (3D dünyada)
 */
export function renderWorldParticles(ctx, viewPlayer, rays) {
    if (!viewPlayer) return;

    const pitch = viewPlayer.pitch || 0;
    const halfWidth = SCREEN.WIDTH / 2;
    const halfHeight = SCREEN.HEIGHT / 2;
    const fov = Math.PI / 3;

    for (const p of activeParticles) {
        if (!p.active || p.screenSpace) continue;

        // Parçacığa olan mesafe ve açı
        const dx = p.x - viewPlayer.x;
        const dy = p.y - viewPlayer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.1 || dist > 20) continue;

        // Açı hesapla
        let angle = Math.atan2(dy, dx) - viewPlayer.angle;
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;

        // FOV dışındaysa atla
        if (Math.abs(angle) > fov / 2 + 0.2) continue;

        // Z-buffer kontrolü (rays ile)
        const screenX = Math.floor(halfWidth + (angle / fov) * SCREEN.WIDTH);
        if (screenX < 0 || screenX >= SCREEN.WIDTH) continue;

        const ray = rays[screenX];
        if (ray && dist > ray.correctedDistance) continue;

        // Ekran Y pozisyonu (yükseklik ve pitch ile)
        const spriteHeight = (1 / dist) * SCREEN.HEIGHT * 0.5;
        const verticalOffset = (0.5 - p.z) * spriteHeight;
        const screenY = halfHeight + verticalOffset + pitch;

        // Parçacık boyutu (mesafeye göre)
        const size = Math.max(1, (p.size * p.scale) / dist);

        // Render
        renderParticle(ctx, p, screenX, screenY, size);
    }
}

/**
 * Ekran parçacıklarını render et (2D UI üzerinde)
 */
export function renderScreenParticles(ctx) {
    for (const p of activeParticles) {
        if (!p.active || !p.screenSpace) continue;

        renderParticle(ctx, p, p.screenX, p.screenY, p.size * p.scale);
    }
}

/**
 * Tek parçacık render
 */
function renderParticle(ctx, p, x, y, size) {
    const alpha = Math.min(1, p.alpha);
    if (alpha <= 0 || size <= 0) return;

    ctx.save();

    switch (p.type) {
        case PARTICLE_TYPES.SPARK:
        case PARTICLE_TYPES.MUZZLE:
            // Parlak kıvılcım
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
            gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`);
            gradient.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size * 2, 0, Math.PI * 2);
            ctx.fill();
            break;

        case PARTICLE_TYPES.BLOOD:
            // Kan damlası
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            break;

        case PARTICLE_TYPES.SMOKE:
        case PARTICLE_TYPES.DUST:
            // Duman/toz
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            break;

        case PARTICLE_TYPES.SHELL:
            // Kovan (dikdörtgen)
            ctx.translate(x, y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
            ctx.fillRect(-size / 2, -size / 4, size, size / 2);
            break;

        case PARTICLE_TYPES.DEBRIS:
            // Moloz parçası
            ctx.translate(x, y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            break;

        case PARTICLE_TYPES.TRAIL:
            // Mermi izi (çizgi)
            ctx.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(x - p.vx * 2, y - p.vy * 2);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;

        case PARTICLE_TYPES.EXPLOSION:
            // Patlama
            const expGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
            expGrad.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
            expGrad.addColorStop(0.3, `rgba(255, 150, 50, ${alpha * 0.8})`);
            expGrad.addColorStop(0.6, `rgba(255, 50, 0, ${alpha * 0.5})`);
            expGrad.addColorStop(1, `rgba(100, 0, 0, 0)`);
            ctx.fillStyle = expGrad;
            ctx.beginPath();
            ctx.arc(x, y, size * 2, 0, Math.PI * 2);
            ctx.fill();
            break;

        case PARTICLE_TYPES.GLOW:
            // Parlama efekti
            const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, size);
            glowGrad.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`);
            glowGrad.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            break;

        default:
            // Varsayılan daire
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
    }

    ctx.restore();
}

// ============================================
// EFEKT FONKSİYONLARI
// ============================================

/**
 * Muzzle flash efekti (silah namlusunda)
 */
export function spawnMuzzleFlash(x, y, angle) {
    // Ana flash
    for (let i = 0; i < 8; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.MUZZLE;
        p.x = x + Math.cos(angle) * 0.3;
        p.y = y + Math.sin(angle) * 0.3;
        p.z = 0.5;

        const spread = (Math.random() - 0.5) * 0.5;
        const speed = 3 + Math.random() * 3;
        p.vx = Math.cos(angle + spread) * speed;
        p.vy = Math.sin(angle + spread) * speed;
        p.vz = (Math.random() - 0.5) * 2;

        p.size = 3 + Math.random() * 4;
        p.color = { r: 255, g: 200 + Math.random() * 55, b: 50 + Math.random() * 100 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.15;
        p.friction = 0.9;
    }

    // Kıvılcımlar
    for (let i = 0; i < 5; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.SPARK;
        p.x = x + Math.cos(angle) * 0.3;
        p.y = y + Math.sin(angle) * 0.3;
        p.z = 0.5;

        const spread = (Math.random() - 0.5) * 1;
        const speed = 5 + Math.random() * 8;
        p.vx = Math.cos(angle + spread) * speed;
        p.vy = Math.sin(angle + spread) * speed;
        p.vz = (Math.random() - 0.3) * 4;

        p.size = 1 + Math.random() * 2;
        p.color = { r: 255, g: 255, b: 200 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.08;
        p.gravity = 5;
        p.friction = 0.98;
    }
}

/**
 * Kan efekti (düşman vurulduğunda)
 */
export function spawnBlood(x, y, z = 0.5, amount = 10) {
    for (let i = 0; i < amount; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.BLOOD;
        p.x = x;
        p.y = y;
        p.z = z;

        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.vz = 1 + Math.random() * 3;

        p.size = 2 + Math.random() * 3;
        // Farklı kan tonları
        p.color = {
            r: 120 + Math.random() * 60,
            g: 0,
            b: 0
        };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.02;
        p.gravity = 8;
        p.friction = 0.99;
        p.bounce = 0.2;
    }
}

/**
 * Kovan atma efekti (silah ateşlendiğinde)
 */
export function spawnShellCasing(screenX, screenY) {
    const p = getParticle();
    if (!p) return;

    p.type = PARTICLE_TYPES.SHELL;
    p.screenSpace = true;
    p.screenX = screenX;
    p.screenY = screenY;

    p.vx = 50 + Math.random() * 80;
    p.vy = -100 - Math.random() * 50;

    p.size = 6;
    p.color = { r: 200, g: 170, b: 50 };
    p.life = 1;
    p.maxLife = 1;
    p.decay = 0.01;
    p.gravity = 15;
    p.rotation = 0;
    p.rotationSpeed = 10 + Math.random() * 20;
}

/**
 * Duvar vuruş efekti
 */
export function spawnWallHit(x, y, z = 0.5) {
    // Moloz parçaları
    for (let i = 0; i < 6; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.DEBRIS;
        p.x = x;
        p.y = y;
        p.z = z;

        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.vz = 1 + Math.random() * 2;

        p.size = 2 + Math.random() * 2;
        p.color = { r: 100, g: 90, b: 80 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.03;
        p.gravity = 10;
        p.friction = 0.95;
        p.rotation = Math.random() * Math.PI;
        p.rotationSpeed = 5 + Math.random() * 10;
    }

    // Toz bulutu
    for (let i = 0; i < 4; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.DUST;
        p.x = x;
        p.y = y;
        p.z = z;

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random();
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.vz = 0.3 + Math.random() * 0.5;

        p.size = 5 + Math.random() * 5;
        p.color = { r: 150, g: 140, b: 130 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.02;
        p.gravity = -0.5; // Yukarı yükseliyor
        p.friction = 0.95;
        p.scaleDecay = 0.02;
    }
}

/**
 * Patlama efekti
 */
export function spawnExplosion(x, y, z = 0.5, size = 1) {
    // Merkez patlama
    for (let i = 0; i < 3; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.EXPLOSION;
        p.x = x + (Math.random() - 0.5) * 0.3;
        p.y = y + (Math.random() - 0.5) * 0.3;
        p.z = z;

        p.vx = 0;
        p.vy = 0;
        p.vz = 0.5;

        p.size = (15 + Math.random() * 10) * size;
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.04;
        p.scale = 0.5;
        p.scaleDecay = -0.05; // Büyüyor
    }

    // Kıvılcımlar
    for (let i = 0; i < 20 * size; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.SPARK;
        p.x = x;
        p.y = y;
        p.z = z;

        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.3) * Math.PI;
        const speed = 3 + Math.random() * 7;

        p.vx = Math.cos(angle) * Math.cos(elevation) * speed;
        p.vy = Math.sin(angle) * Math.cos(elevation) * speed;
        p.vz = Math.sin(elevation) * speed;

        p.size = 1 + Math.random() * 2;
        p.color = {
            r: 255,
            g: 100 + Math.random() * 155,
            b: Math.random() * 50
        };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.03;
        p.gravity = 5;
        p.friction = 0.98;
    }

    // Duman
    for (let i = 0; i < 8 * size; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.SMOKE;
        p.x = x + (Math.random() - 0.5) * 0.5;
        p.y = y + (Math.random() - 0.5) * 0.5;
        p.z = z;

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random();
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.vz = 1 + Math.random() * 2;

        p.size = 8 + Math.random() * 8;
        p.color = { r: 60, g: 60, b: 60 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.015;
        p.gravity = -1;
        p.friction = 0.95;
        p.scale = 0.5;
        p.scaleDecay = -0.02;
    }
}

/**
 * Düşman ölüm efekti
 */
export function spawnDeathEffect(x, y) {
    // Büyük kan patlaması
    spawnBlood(x, y, 0.5, 25);

    // Ekstra kırmızı parçacıklar
    for (let i = 0; i < 10; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.GLOW;
        p.x = x;
        p.y = y;
        p.z = 0.3 + Math.random() * 0.4;

        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.vz = 0.5 + Math.random();

        p.size = 5 + Math.random() * 5;
        p.color = { r: 255, g: 0, b: 0 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.03;
        p.gravity = 2;
    }
}

/**
 * Ortam parçacıkları (toz, kıvılcım vb.)
 */
export function spawnAmbientDust(viewPlayer) {
    // Her frame'de küçük şansla toz parçacığı
    if (Math.random() > 0.1) return;

    const p = getParticle();
    if (!p) return;

    p.type = PARTICLE_TYPES.DUST;

    // Oyuncunun etrafında rastgele
    const angle = Math.random() * Math.PI * 2;
    const dist = 2 + Math.random() * 5;

    p.x = viewPlayer.x + Math.cos(angle) * dist;
    p.y = viewPlayer.y + Math.sin(angle) * dist;
    p.z = Math.random();

    p.vx = (Math.random() - 0.5) * 0.2;
    p.vy = (Math.random() - 0.5) * 0.2;
    p.vz = 0.1 + Math.random() * 0.2;

    p.size = 1 + Math.random() * 2;
    p.color = { r: 180, g: 170, b: 160 };
    p.life = 1;
    p.maxLife = 1;
    p.decay = 0.005;
    p.gravity = -0.2;
    p.friction = 0.99;
}

/**
 * Pickup efekti (loot alındığında)
 */
export function spawnPickupEffect(x, y, color = { r: 255, g: 255, b: 0 }) {
    for (let i = 0; i < 12; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.GLOW;
        p.x = x;
        p.y = y;
        p.z = 0.3;

        const angle = (i / 12) * Math.PI * 2;
        p.vx = Math.cos(angle) * 2;
        p.vy = Math.sin(angle) * 2;
        p.vz = 2 + Math.random();

        p.size = 4;
        p.color = color;
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.04;
        p.gravity = 0;
        p.friction = 0.95;
    }

    // Yukarı çıkan parıltılar
    for (let i = 0; i < 8; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.SPARK;
        p.x = x + (Math.random() - 0.5) * 0.3;
        p.y = y + (Math.random() - 0.5) * 0.3;
        p.z = 0.2;

        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = (Math.random() - 0.5) * 0.5;
        p.vz = 3 + Math.random() * 2;

        p.size = 2;
        p.color = { r: 255, g: 255, b: 255 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.03;
        p.gravity = -1;
    }
}

/**
 * Ekran üzerinde hit marker efekti
 */
export function spawnHitMarker() {
    const cx = SCREEN.WIDTH / 2;
    const cy = SCREEN.HEIGHT / 2;

    for (let i = 0; i < 4; i++) {
        const p = getParticle();
        if (!p) continue;

        p.type = PARTICLE_TYPES.SPARK;
        p.screenSpace = true;

        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        p.screenX = cx + Math.cos(angle) * 15;
        p.screenY = cy + Math.sin(angle) * 15;

        p.vx = Math.cos(angle) * 50;
        p.vy = Math.sin(angle) * 50;

        p.size = 3;
        p.color = { r: 255, g: 50, b: 50 };
        p.life = 1;
        p.maxLife = 1;
        p.decay = 0.1;
        p.gravity = 0;
    }
}

/**
 * Aktif parçacık sayısını al (debug için)
 */
export function getActiveParticleCount() {
    return activeParticles.length;
}

/**
 * Tüm parçacıkları temizle
 */
export function clearParticles() {
    for (const p of activeParticles) {
        p.active = false;
    }
    activeParticles.length = 0;
}
