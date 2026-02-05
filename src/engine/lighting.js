// Lighting - Dinamik ışık sistemi
// Point light, muzzle flash, flicker efektleri

import { SCREEN } from '../core/config.js';

// Işık tipleri
export const LIGHT_TYPES = {
    POINT: 'point',       // Normal nokta ışığı
    MUZZLE: 'muzzle',     // Silah ateşi (kısa süreli)
    FLICKER: 'flicker',   // Meşale (titreyen)
    PULSE: 'pulse'        // Nabız gibi atan ışık
};

// Işık renkleri (preset)
export const LIGHT_COLORS = {
    WARM: { r: 255, g: 200, b: 150 },
    COOL: { r: 150, g: 200, b: 255 },
    FIRE: { r: 255, g: 150, b: 50 },
    MUZZLE: { r: 255, g: 220, b: 100 },
    TECH: { r: 100, g: 200, b: 255 },
    RED: { r: 255, g: 50, b: 50 },
    GREEN: { r: 50, g: 255, b: 100 },
    LAVA: { r: 255, g: 100, b: 20 }
};

// Tek bir ışık kaynağı
class Light {
    constructor(type, x, y, radius, color, intensity = 1.0) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = { ...color };
        this.intensity = intensity;
        this.baseIntensity = intensity;

        // Animasyon state
        this.active = true;
        this.lifetime = 0;  // 0 = sonsuz
        this.elapsed = 0;

        // Flicker için
        this.flickerSpeed = 10;
        this.flickerAmount = 0.3;
        this.flickerPhase = Math.random() * Math.PI * 2;

        // Pulse için
        this.pulseSpeed = 2;
        this.pulseAmount = 0.5;
    }

    update(dt) {
        this.elapsed += dt;

        // Ömür kontrolü
        if (this.lifetime > 0) {
            if (this.elapsed >= this.lifetime) {
                this.active = false;
                return;
            }
            // Fade out
            const fadeStart = this.lifetime * 0.7;
            if (this.elapsed > fadeStart) {
                const fadeProgress = (this.elapsed - fadeStart) / (this.lifetime - fadeStart);
                this.intensity = this.baseIntensity * (1 - fadeProgress);
            }
        }

        // Tip bazlı animasyonlar
        switch (this.type) {
            case LIGHT_TYPES.FLICKER:
                // Meşale efekti - düzensiz titreme
                const noise1 = Math.sin(this.elapsed * this.flickerSpeed + this.flickerPhase);
                const noise2 = Math.sin(this.elapsed * this.flickerSpeed * 2.3 + this.flickerPhase * 1.7);
                const flicker = (noise1 + noise2) * 0.5 * this.flickerAmount;
                this.intensity = this.baseIntensity * (1 + flicker);
                break;

            case LIGHT_TYPES.PULSE:
                // Düzenli nabız
                const pulse = Math.sin(this.elapsed * this.pulseSpeed) * this.pulseAmount;
                this.intensity = this.baseIntensity * (1 + pulse);
                break;

            case LIGHT_TYPES.MUZZLE:
                // Hızlı fade out
                this.intensity = this.baseIntensity * Math.max(0, 1 - this.elapsed * 10);
                if (this.intensity <= 0) this.active = false;
                break;
        }
    }

    // Verilen noktaya olan ışık katkısını hesapla
    calculateContribution(worldX, worldY) {
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist >= this.radius) return 0;

        // Quadratic falloff (daha doğal görünüm)
        const falloff = 1 - (dist / this.radius);
        return falloff * falloff * this.intensity;
    }
}

// Işık sistemi yöneticisi
export class LightingSystem {
    constructor() {
        this.lights = [];
        this.ambientLight = 0.15;  // Temel ortam ışığı
        this.ambientColor = { r: 20, g: 25, b: 40 };  // Mavi-gri ambient

        // Oyuncu el feneri (opsiyonel)
        this.flashlightEnabled = false;
        this.flashlightAngle = 0;
        this.flashlightCone = Math.PI / 4;  // 45 derece
        this.flashlightRange = 8;
        this.flashlightIntensity = 0.8;

        // Performans için ön-hesaplanmış lightmap
        this.lightMapWidth = 64;   // Düşük çözünürlük
        this.lightMapHeight = 40;
        this.lightMap = null;

        console.log('💡 Işık sistemi başlatıldı');
    }

    // Işık ekle
    addLight(type, x, y, radius, color = LIGHT_COLORS.WARM, intensity = 1.0) {
        const light = new Light(type, x, y, radius, color, intensity);
        this.lights.push(light);
        return light;
    }

    // Muzzle flash ekle (otomatik kısa ömürlü)
    addMuzzleFlash(x, y) {
        const light = new Light(LIGHT_TYPES.MUZZLE, x, y, 4, LIGHT_COLORS.MUZZLE, 2.0);
        light.lifetime = 0.1;
        this.lights.push(light);
        return light;
    }

    // Meşale ekle
    addTorch(x, y) {
        const light = new Light(LIGHT_TYPES.FLICKER, x, y, 5, LIGHT_COLORS.FIRE, 0.8);
        light.flickerSpeed = 8 + Math.random() * 4;
        light.flickerAmount = 0.2 + Math.random() * 0.2;
        this.lights.push(light);
        return light;
    }

    // Tech ışığı ekle (mavi, pulse)
    addTechLight(x, y, radius = 3) {
        const light = new Light(LIGHT_TYPES.PULSE, x, y, radius, LIGHT_COLORS.TECH, 0.6);
        light.pulseSpeed = 1.5 + Math.random();
        light.pulseAmount = 0.3;
        this.lights.push(light);
        return light;
    }

    // Patlama ışığı (büyük, kısa)
    addExplosionLight(x, y) {
        const light = new Light(LIGHT_TYPES.POINT, x, y, 8, LIGHT_COLORS.FIRE, 3.0);
        light.lifetime = 0.3;
        this.lights.push(light);
        return light;
    }

    // Tüm ışıkları güncelle
    update(dt) {
        // Her ışığı güncelle
        for (const light of this.lights) {
            light.update(dt);
        }

        // Ölü ışıkları temizle
        this.lights = this.lights.filter(light => light.active);
    }

    // Verilen dünya koordinatındaki toplam ışık seviyesini hesapla
    calculateLightAt(worldX, worldY, playerX, playerY, playerAngle) {
        let totalLight = this.ambientLight;
        let lightColor = { ...this.ambientColor };

        // El feneri katkısı
        if (this.flashlightEnabled) {
            const flashContrib = this.calculateFlashlightContribution(
                worldX, worldY, playerX, playerY, playerAngle
            );
            if (flashContrib > 0) {
                totalLight += flashContrib * this.flashlightIntensity;
                lightColor.r += 200 * flashContrib;
                lightColor.g += 200 * flashContrib;
                lightColor.b += 180 * flashContrib;
            }
        }

        // Tüm ışık kaynaklarından katkı
        for (const light of this.lights) {
            const contrib = light.calculateContribution(worldX, worldY);
            if (contrib > 0) {
                totalLight += contrib;
                lightColor.r += light.color.r * contrib * 0.5;
                lightColor.g += light.color.g * contrib * 0.5;
                lightColor.b += light.color.b * contrib * 0.5;
            }
        }

        return {
            intensity: Math.min(1.5, totalLight),  // Clamp to prevent overbrightness
            color: {
                r: Math.min(255, lightColor.r),
                g: Math.min(255, lightColor.g),
                b: Math.min(255, lightColor.b)
            }
        };
    }

    // El feneri katkısı
    calculateFlashlightContribution(worldX, worldY, playerX, playerY, playerAngle) {
        const dx = worldX - playerX;
        const dy = worldY - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > this.flashlightRange) return 0;

        // Açı kontrolü
        const angleToPoint = Math.atan2(dy, dx);
        let angleDiff = angleToPoint - playerAngle;

        // Açı normalizasyonu
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) > this.flashlightCone / 2) return 0;

        // Mesafe ve açı bazlı falloff
        const distFalloff = 1 - (dist / this.flashlightRange);
        const angleFalloff = 1 - (Math.abs(angleDiff) / (this.flashlightCone / 2));

        return distFalloff * angleFalloff;
    }

    // Işık haritası oluştur (performans için)
    buildLightMap(map, playerX, playerY, playerAngle) {
        if (!this.lightMap) {
            this.lightMap = new Float32Array(this.lightMapWidth * this.lightMapHeight * 3);
        }

        const scaleX = map.width / this.lightMapWidth;
        const scaleY = map.height / this.lightMapHeight;

        for (let y = 0; y < this.lightMapHeight; y++) {
            for (let x = 0; x < this.lightMapWidth; x++) {
                const worldX = x * scaleX + 0.5;
                const worldY = y * scaleY + 0.5;

                const lighting = this.calculateLightAt(worldX, worldY, playerX, playerY, playerAngle);

                const idx = (y * this.lightMapWidth + x) * 3;
                this.lightMap[idx] = lighting.intensity;
                this.lightMap[idx + 1] = lighting.color.r / 255;
                this.lightMap[idx + 2] = lighting.color.g / 255;
                // B kanalı için yer yok, R ve G yeterli
            }
        }

        return this.lightMap;
    }

    // Işık haritasından bilinear interpolasyon ile değer al
    sampleLightMap(worldX, worldY, mapWidth, mapHeight) {
        if (!this.lightMap) {
            return { intensity: this.ambientLight, color: this.ambientColor };
        }

        const u = (worldX / mapWidth) * (this.lightMapWidth - 1);
        const v = (worldY / mapHeight) * (this.lightMapHeight - 1);

        const x0 = Math.floor(u);
        const y0 = Math.floor(v);
        const x1 = Math.min(x0 + 1, this.lightMapWidth - 1);
        const y1 = Math.min(y0 + 1, this.lightMapHeight - 1);

        const fx = u - x0;
        const fy = v - y0;

        // Bilinear interpolation
        const idx00 = (y0 * this.lightMapWidth + x0) * 3;
        const idx10 = (y0 * this.lightMapWidth + x1) * 3;
        const idx01 = (y1 * this.lightMapWidth + x0) * 3;
        const idx11 = (y1 * this.lightMapWidth + x1) * 3;

        const intensity =
            this.lightMap[idx00] * (1 - fx) * (1 - fy) +
            this.lightMap[idx10] * fx * (1 - fy) +
            this.lightMap[idx01] * (1 - fx) * fy +
            this.lightMap[idx11] * fx * fy;

        return {
            intensity: intensity,
            color: this.ambientColor  // Basitleştirilmiş
        };
    }

    // Duvar pixel'ine ışık uygula
    applyLightingToColor(r, g, b, lightIntensity) {
        // Basit multiplicative lighting
        const lit = Math.min(1.5, lightIntensity);  // Slight overbrightness allowed

        return {
            r: Math.min(255, Math.floor(r * lit)),
            g: Math.min(255, Math.floor(g * lit)),
            b: Math.min(255, Math.floor(b * lit))
        };
    }

    // Tüm ışıkları temizle
    clear() {
        this.lights = [];
    }

    // Işık sayısı
    getLightCount() {
        return this.lights.length;
    }

    // El fenerini aç/kapat
    toggleFlashlight() {
        this.flashlightEnabled = !this.flashlightEnabled;
        return this.flashlightEnabled;
    }
}

// Global instance
let lightingSystemInstance = null;

export function initLightingSystem() {
    lightingSystemInstance = new LightingSystem();
    return lightingSystemInstance;
}

export function getLightingSystem() {
    return lightingSystemInstance;
}

// Kısayol fonksiyonları
export function addMuzzleFlash(x, y) {
    if (lightingSystemInstance) {
        return lightingSystemInstance.addMuzzleFlash(x, y);
    }
}

export function addTorch(x, y) {
    if (lightingSystemInstance) {
        return lightingSystemInstance.addTorch(x, y);
    }
}

export function addExplosionLight(x, y) {
    if (lightingSystemInstance) {
        return lightingSystemInstance.addExplosionLight(x, y);
    }
}

export function addTechLight(x, y, radius = 3) {
    if (lightingSystemInstance) {
        return lightingSystemInstance.addTechLight(x, y, radius);
    }
}
