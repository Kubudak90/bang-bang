// Particles - Performanslı partikül sistemi
// Object pooling ile allocation önleme

import { SCREEN } from '../core/config.js';

// Partikül tipleri ve özellikleri
export const PARTICLE_TYPES = {
    BLOOD: {
        color: { r: 180, g: 20, b: 20 },
        colorVariation: 30,
        size: { min: 2, max: 4 },
        speed: { min: 2, max: 5 },
        gravity: 8,
        lifetime: { min: 0.5, max: 1.0 },
        fadeOut: true,
        count: { min: 5, max: 12 }
    },

    BLOOD_SPLATTER: {
        color: { r: 150, g: 10, b: 10 },
        colorVariation: 20,
        size: { min: 3, max: 6 },
        speed: { min: 3, max: 8 },
        gravity: 12,
        lifetime: { min: 0.3, max: 0.6 },
        fadeOut: true,
        count: { min: 8, max: 20 }
    },

    SPARK: {
        color: { r: 255, g: 200, b: 50 },
        colorVariation: 50,
        size: { min: 1, max: 3 },
        speed: { min: 4, max: 10 },
        gravity: 3,
        lifetime: { min: 0.2, max: 0.5 },
        fadeOut: true,
        count: { min: 3, max: 8 }
    },

    SMOKE: {
        color: { r: 80, g: 80, b: 80 },
        colorVariation: 20,
        size: { min: 4, max: 8 },
        speed: { min: 0.5, max: 1.5 },
        gravity: -1, // Yukarı hareket
        lifetime: { min: 1.0, max: 2.0 },
        fadeOut: true,
        growRate: 2, // Büyüme hızı
        count: { min: 3, max: 6 }
    },

    DEBRIS: {
        color: { r: 120, g: 100, b: 80 },
        colorVariation: 30,
        size: { min: 2, max: 4 },
        speed: { min: 3, max: 7 },
        gravity: 15,
        lifetime: { min: 0.4, max: 0.8 },
        fadeOut: false,
        bounce: 0.3,
        count: { min: 4, max: 10 }
    },

    SHELL: {
        color: { r: 180, g: 150, b: 50 },
        colorVariation: 20,
        size: { min: 2, max: 3 },
        speed: { min: 2, max: 4 },
        gravity: 12,
        lifetime: { min: 0.8, max: 1.2 },
        fadeOut: false,
        bounce: 0.4,
        spinRate: 10,
        count: { min: 1, max: 1 }
    },

    MUZZLE_FLASH: {
        color: { r: 255, g: 220, b: 100 },
        colorVariation: 30,
        size: { min: 3, max: 6 },
        speed: { min: 8, max: 15 },
        gravity: 0,
        lifetime: { min: 0.05, max: 0.1 },
        fadeOut: true,
        count: { min: 5, max: 10 }
    },

    EXPLOSION: {
        color: { r: 255, g: 150, b: 50 },
        colorVariation: 50,
        size: { min: 4, max: 10 },
        speed: { min: 5, max: 15 },
        gravity: 2,
        lifetime: { min: 0.3, max: 0.8 },
        fadeOut: true,
        count: { min: 20, max: 40 }
    },

    DUST: {
        color: { r: 150, g: 140, b: 120 },
        colorVariation: 20,
        size: { min: 2, max: 4 },
        speed: { min: 0.5, max: 2 },
        gravity: -0.5,
        lifetime: { min: 0.5, max: 1.5 },
        fadeOut: true,
        count: { min: 2, max: 5 }
    },

    HEAL: {
        color: { r: 50, g: 255, b: 100 },
        colorVariation: 30,
        size: { min: 2, max: 4 },
        speed: { min: 1, max: 3 },
        gravity: -2,
        lifetime: { min: 0.5, max: 1.0 },
        fadeOut: true,
        count: { min: 8, max: 15 }
    },

    PICKUP: {
        color: { r: 255, g: 255, b: 100 },
        colorVariation: 30,
        size: { min: 2, max: 4 },
        speed: { min: 2, max: 5 },
        gravity: -1,
        lifetime: { min: 0.4, max: 0.8 },
        fadeOut: true,
        count: { min: 10, max: 20 }
    }
};

// Tek bir partikül
class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.worldX = 0;
        this.worldY = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 2;
        this.originalSize = 2;
        this.color = { r: 255, g: 255, b: 255 };
        this.alpha = 1;
        this.life = 0;
        this.maxLife = 1;
        this.gravity = 0;
        this.fadeOut = true;
        this.growRate = 0;
        this.bounce = 0;
        this.spin = 0;
        this.spinRate = 0;
        this.isScreenSpace = false;
    }

    init(config, x, y, angle, isScreenSpace = false) {
        this.active = true;
        this.isScreenSpace = isScreenSpace;

        if (isScreenSpace) {
            this.x = x;
            this.y = y;
        } else {
            this.worldX = x;
            this.worldY = y;
        }

        // Rastgele yön ve hız
        const spreadAngle = angle + (Math.random() - 0.5) * Math.PI;
        const speed = randomRange(config.speed.min, config.speed.max);

        this.vx = Math.cos(spreadAngle) * speed;
        this.vy = Math.sin(spreadAngle) * speed;

        // Boyut
        this.size = randomRange(config.size.min, config.size.max);
        this.originalSize = this.size;

        // Renk (varyasyon ile)
        const variation = config.colorVariation || 0;
        this.color = {
            r: clamp(config.color.r + (Math.random() - 0.5) * variation, 0, 255),
            g: clamp(config.color.g + (Math.random() - 0.5) * variation, 0, 255),
            b: clamp(config.color.b + (Math.random() - 0.5) * variation, 0, 255)
        };

        // Fizik
        this.gravity = config.gravity || 0;
        this.bounce = config.bounce || 0;
        this.growRate = config.growRate || 0;
        this.spinRate = config.spinRate || 0;
        this.spin = 0;

        // Yaşam
        this.life = randomRange(config.lifetime.min, config.lifetime.max);
        this.maxLife = this.life;
        this.alpha = 1;
        this.fadeOut = config.fadeOut !== false;
    }

    update(dt) {
        if (!this.active) return;

        // Hareket
        if (this.isScreenSpace) {
            this.x += this.vx * dt * 60;
            this.y += this.vy * dt * 60;
        } else {
            this.worldX += this.vx * dt;
            this.worldY += this.vy * dt;
        }

        // Yerçekimi
        this.vy += this.gravity * dt;

        // Büyüme
        if (this.growRate !== 0) {
            this.size += this.growRate * dt;
        }

        // Dönüş
        if (this.spinRate !== 0) {
            this.spin += this.spinRate * dt;
        }

        // Zemin bounce (screen space için)
        if (this.isScreenSpace && this.bounce > 0 && this.y > SCREEN.HEIGHT - 20) {
            this.y = SCREEN.HEIGHT - 20;
            this.vy = -this.vy * this.bounce;
            this.vx *= 0.8;
        }

        // Yaşam
        this.life -= dt;

        // Fade out
        if (this.fadeOut) {
            this.alpha = Math.max(0, this.life / this.maxLife);
        }

        // Ölüm kontrolü
        if (this.life <= 0) {
            this.active = false;
        }
    }
}

// Partikül sistemi
export class ParticleSystem {
    constructor(maxParticles = 1000) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.activeCount = 0;

        // Object pool oluştur
        for (let i = 0; i < maxParticles; i++) {
            this.particles.push(new Particle());
        }

        console.log(`✨ Partikül sistemi başlatıldı (max: ${maxParticles})`);
    }

    /**
     * Partikül yay - dünya koordinatlarında
     */
    emit(type, worldX, worldY, angle = 0, countOverride = null) {
        const config = PARTICLE_TYPES[type];
        if (!config) {
            console.warn(`Bilinmeyen partikül tipi: ${type}`);
            return;
        }

        const count = countOverride || randomRangeInt(config.count.min, config.count.max);

        for (let i = 0; i < count; i++) {
            const particle = this.getInactiveParticle();
            if (particle) {
                particle.init(config, worldX, worldY, angle, false);
            }
        }
    }

    /**
     * Partikül yay - ekran koordinatlarında (UI efektleri için)
     */
    emitScreen(type, screenX, screenY, angle = 0, countOverride = null) {
        const config = PARTICLE_TYPES[type];
        if (!config) {
            console.warn(`Bilinmeyen partikül tipi: ${type}`);
            return;
        }

        const count = countOverride || randomRangeInt(config.count.min, config.count.max);

        for (let i = 0; i < count; i++) {
            const particle = this.getInactiveParticle();
            if (particle) {
                particle.init(config, screenX, screenY, angle, true);
            }
        }
    }

    /**
     * Özel renk ile partikül yay
     */
    emitCustom(type, worldX, worldY, angle, customColor, countOverride = null) {
        const config = { ...PARTICLE_TYPES[type] };
        if (!config) return;

        config.color = customColor;

        const count = countOverride || randomRangeInt(config.count.min, config.count.max);

        for (let i = 0; i < count; i++) {
            const particle = this.getInactiveParticle();
            if (particle) {
                particle.init(config, worldX, worldY, angle, false);
            }
        }
    }

    /**
     * Havai fişek patlaması efekti
     */
    emitBurst(worldX, worldY, type, count = 20) {
        const angleStep = (Math.PI * 2) / count;
        for (let i = 0; i < count; i++) {
            this.emit(type, worldX, worldY, angleStep * i, 1);
        }
    }

    /**
     * Kullanılmayan partikül al
     */
    getInactiveParticle() {
        for (const particle of this.particles) {
            if (!particle.active) {
                return particle;
            }
        }
        // Pool dolu, en eski aktif partiküı recycle et
        let oldest = this.particles[0];
        for (const particle of this.particles) {
            if (particle.life < oldest.life) {
                oldest = particle;
            }
        }
        oldest.reset();
        return oldest;
    }

    /**
     * Tüm partikülleri güncelle
     */
    update(dt) {
        this.activeCount = 0;

        for (const particle of this.particles) {
            if (particle.active) {
                particle.update(dt);
                this.activeCount++;
            }
        }
    }

    /**
     * Dünya partiküllerini render et (3D uzayda)
     */
    renderWorld(ctx, player, zBuffer) {
        const halfWidth = SCREEN.WIDTH / 2;
        const halfHeight = SCREEN.HEIGHT / 2;

        // Aktif partikülleri mesafeye göre sırala (uzaktan yakına)
        const worldParticles = this.particles
            .filter(p => p.active && !p.isScreenSpace)
            .map(p => {
                const dx = p.worldX - player.x;
                const dy = p.worldY - player.y;
                return { particle: p, dist: Math.sqrt(dx * dx + dy * dy) };
            })
            .sort((a, b) => b.dist - a.dist);

        for (const { particle, dist } of worldParticles) {
            if (dist < 0.2 || dist > 15) continue;

            // Oyuncuya göre açı
            const dx = particle.worldX - player.x;
            const dy = particle.worldY - player.y;
            const angle = Math.atan2(dy, dx);

            // Görüş açısı içinde mi?
            let relativeAngle = angle - player.angle;
            while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
            while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

            const fov = Math.PI / 3; // 60 derece
            if (Math.abs(relativeAngle) > fov / 2 + 0.2) continue;

            // Ekran pozisyonu
            const screenX = halfWidth + (relativeAngle / (fov / 2)) * halfWidth;

            // Z-buffer kontrolü
            const bufferIndex = Math.floor(screenX);
            if (bufferIndex >= 0 && bufferIndex < SCREEN.WIDTH) {
                if (zBuffer && zBuffer[bufferIndex] < dist) continue;
            }

            // Boyut (perspektif)
            const scale = 1 / dist;
            const size = Math.max(1, particle.size * scale * 30);

            // Pitch offset
            const pitchOffset = player.pitch || 0;
            const screenY = halfHeight + pitchOffset - (scale * 20);

            // Render
            const { r, g, b } = particle.color;
            ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${particle.alpha})`;

            if (particle.spinRate !== 0) {
                // Dönen partikül
                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(particle.spin);
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.restore();
            } else {
                // Normal partikül
                ctx.beginPath();
                ctx.arc(screenX, screenY, size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Ekran partiküllerini render et (UI overlay)
     */
    renderScreen(ctx) {
        for (const particle of this.particles) {
            if (!particle.active || !particle.isScreenSpace) continue;

            const { r, g, b } = particle.color;
            ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${particle.alpha})`;

            if (particle.spinRate !== 0) {
                ctx.save();
                ctx.translate(particle.x, particle.y);
                ctx.rotate(particle.spin);
                ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Tüm partikülleri temizle
     */
    clear() {
        for (const particle of this.particles) {
            particle.reset();
        }
        this.activeCount = 0;
    }

    /**
     * Aktif partikül sayısı
     */
    getActiveCount() {
        return this.activeCount;
    }
}

// Yardımcı fonksiyonlar
function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

function randomRangeInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Global partikül sistemi instance'ı
let particleSystemInstance = null;

export function initParticleSystem(maxParticles = 1000) {
    particleSystemInstance = new ParticleSystem(maxParticles);
    return particleSystemInstance;
}

export function getParticleSystem() {
    return particleSystemInstance;
}

// Kısayol fonksiyonları
export function emitBlood(x, y, angle = Math.PI) {
    if (particleSystemInstance) {
        particleSystemInstance.emit('BLOOD', x, y, angle);
    }
}

export function emitSpark(x, y, angle = 0) {
    if (particleSystemInstance) {
        particleSystemInstance.emit('SPARK', x, y, angle);
    }
}

export function emitSmoke(x, y) {
    if (particleSystemInstance) {
        particleSystemInstance.emit('SMOKE', x, y, -Math.PI / 2);
    }
}

export function emitMuzzleFlash(screenX, screenY) {
    if (particleSystemInstance) {
        particleSystemInstance.emitScreen('MUZZLE_FLASH', screenX, screenY, -Math.PI / 2);
    }
}

export function emitShell(screenX, screenY) {
    if (particleSystemInstance) {
        particleSystemInstance.emitScreen('SHELL', screenX, screenY, -Math.PI / 4);
    }
}

export function emitExplosion(x, y) {
    if (particleSystemInstance) {
        particleSystemInstance.emitBurst(x, y, 'EXPLOSION', 30);
        particleSystemInstance.emit('SMOKE', x, y, -Math.PI / 2, 10);
    }
}

export function emitDust(x, y) {
    if (particleSystemInstance) {
        particleSystemInstance.emit('DUST', x, y, Math.random() * Math.PI * 2);
    }
}

export function emitHeal(x, y) {
    if (particleSystemInstance) {
        particleSystemInstance.emit('HEAL', x, y, -Math.PI / 2);
    }
}

export function emitPickup(x, y, color = null) {
    if (particleSystemInstance) {
        if (color) {
            particleSystemInstance.emitCustom('PICKUP', x, y, -Math.PI / 2, color);
        } else {
            particleSystemInstance.emit('PICKUP', x, y, -Math.PI / 2);
        }
    }
}
