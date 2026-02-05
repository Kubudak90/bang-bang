// PostProcess - Retro görsel efektler
// CRT scanlines, vignette, chromatic aberration, film grain

import { SCREEN } from '../core/config.js';

// Efekt ayarları
export const POST_EFFECTS = {
    CRT: {
        enabled: true,
        scanlineIntensity: 0.15,      // Scanline karanlığı
        scanlineWidth: 2,             // Her kaç pixelde bir
        curvature: 0.02,              // Ekran kavisliği (0 = düz)
        vignetteInner: 0.3,           // Vignette başlangıç
        vignetteOuter: 1.0,           // Vignette bitiş
        vignetteIntensity: 0.4        // Vignette karanlığı
    },

    BLOOM: {
        enabled: false,               // Performans için kapalı varsayılan
        threshold: 0.7,               // Parlaklık eşiği
        intensity: 0.3,               // Bloom gücü
        radius: 4                     // Yayılma yarıçapı
    },

    ABERRATION: {
        enabled: true,
        intensity: 1.5                // Pixel kayma miktarı
    },

    GRAIN: {
        enabled: true,
        intensity: 0.03,              // Grain yoğunluğu
        animated: true                // Her frame farklı mı
    },

    DAMAGE: {
        intensity: 0,                 // 0-1, hasar alınca artar
        pulseSpeed: 8,                // Nabız hızı
        color: { r: 255, g: 0, b: 0 }
    }
};

// Post-processor sınıfı
export class PostProcessor {
    constructor() {
        this.enabled = true;
        this.effects = { ...POST_EFFECTS };

        // Geçici buffer (bazı efektler için)
        this.tempBuffer = null;
        this.tempImageData = null;

        // Damage efekti için
        this.damageTime = 0;

        console.log('🎬 Post-processing sistemi başlatıldı');
    }

    /**
     * Ana render sonrası efektleri uygula
     */
    process(ctx, imageData) {
        if (!this.enabled) return imageData;

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // 1. Chromatic aberration (RGB kayması)
        if (this.effects.ABERRATION.enabled) {
            this.applyAberration(data, width, height);
        }

        // 2. CRT efektleri (scanlines + vignette + curvature)
        if (this.effects.CRT.enabled) {
            this.applyCRT(data, width, height);
        }

        // 3. Film grain
        if (this.effects.GRAIN.enabled) {
            this.applyGrain(data, width, height);
        }

        // 4. Damage overlay
        if (this.effects.DAMAGE.intensity > 0) {
            this.applyDamage(data, width, height);
        }

        return imageData;
    }

    /**
     * Chromatic Aberration - RGB kanallarını kaydır
     */
    applyAberration(data, width, height) {
        const intensity = this.effects.ABERRATION.intensity;
        if (intensity <= 0) return;

        // Sadece kenarlarda uygula (performans için)
        const edgeThreshold = 0.7;  // Ekranın %70'inden sonra

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Merkeze olan normalize mesafe
                const nx = (x / width) * 2 - 1;
                const ny = (y / height) * 2 - 1;
                const dist = Math.sqrt(nx * nx + ny * ny);

                if (dist < edgeThreshold) continue;

                // Kenarlara doğru artan kayma
                const shift = Math.floor((dist - edgeThreshold) / (1 - edgeThreshold) * intensity);

                if (shift <= 0) continue;

                const idx = (y * width + x) * 4;

                // Kırmızı kanalı dışa kaydır
                const redX = Math.min(width - 1, x + shift);
                const redIdx = (y * width + redX) * 4;

                // Mavi kanalı içe kaydır
                const blueX = Math.max(0, x - shift);
                const blueIdx = (y * width + blueX) * 4;

                // Orijinal değerleri kaydet
                const origR = data[idx];
                const origB = data[idx + 2];

                // Yeni değerleri ata (blend)
                data[idx] = Math.floor((origR + data[redIdx]) / 2);
                data[idx + 2] = Math.floor((origB + data[blueIdx + 2]) / 2);
            }
        }
    }

    /**
     * CRT efektleri - scanlines, vignette, curvature
     */
    applyCRT(data, width, height) {
        const crt = this.effects.CRT;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let y = 0; y < height; y++) {
            // Scanline karartması
            const isScanline = (y % crt.scanlineWidth) === 0;
            const scanlineMult = isScanline ? (1 - crt.scanlineIntensity) : 1;

            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Vignette (köşe karartması)
                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;

                let vignetteMult = 1;
                if (dist > crt.vignetteInner) {
                    const vignetteRange = crt.vignetteOuter - crt.vignetteInner;
                    const vignetteProgress = (dist - crt.vignetteInner) / vignetteRange;
                    vignetteMult = 1 - (vignetteProgress * crt.vignetteIntensity);
                    vignetteMult = Math.max(0, vignetteMult);
                }

                // Barrel distortion simulasyonu (sadece karartma ile)
                // Gerçek distortion çok pahalı, sadece renk koyulaştırma
                let curveMult = 1;
                if (crt.curvature > 0) {
                    const curveEffect = dist * dist * crt.curvature;
                    curveMult = 1 - curveEffect;
                }

                // Toplam çarpan
                const totalMult = scanlineMult * vignetteMult * curveMult;

                // Uygula
                data[idx] = Math.floor(data[idx] * totalMult);
                data[idx + 1] = Math.floor(data[idx + 1] * totalMult);
                data[idx + 2] = Math.floor(data[idx + 2] * totalMult);
            }
        }
    }

    /**
     * Film grain efekti
     */
    applyGrain(data, width, height) {
        const intensity = this.effects.GRAIN.intensity;
        if (intensity <= 0) return;

        const grainAmount = intensity * 255;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * grainAmount;

            data[i] = clamp(data[i] + noise, 0, 255);
            data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
            data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
        }
    }

    /**
     * Damage overlay efekti
     */
    applyDamage(data, width, height) {
        const damage = this.effects.DAMAGE;
        if (damage.intensity <= 0) return;

        this.damageTime += 0.016;  // ~60fps varsayımı

        // Nabız efekti
        const pulse = 0.5 + Math.sin(this.damageTime * damage.pulseSpeed) * 0.5;
        const effectIntensity = damage.intensity * pulse;

        const centerX = width / 2;
        const centerY = height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Kenarlara doğru artan kırmızılık
                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;

                // Kenar ağırlıklı efekt
                const edgeFactor = dist * dist;
                const overlay = effectIntensity * edgeFactor;

                // Kırmızı overlay ekle
                data[idx] = clamp(data[idx] + damage.color.r * overlay, 0, 255);
                data[idx + 1] = clamp(data[idx + 1] - 50 * overlay, 0, 255);
                data[idx + 2] = clamp(data[idx + 2] - 50 * overlay, 0, 255);
            }
        }

        // Intensity zamanla azalsın
        damage.intensity *= 0.95;
        if (damage.intensity < 0.01) {
            damage.intensity = 0;
            this.damageTime = 0;
        }
    }

    /**
     * Bloom efekti (pahalı, opsiyonel)
     */
    applyBloom(data, width, height) {
        const bloom = this.effects.BLOOM;
        if (!bloom.enabled || bloom.intensity <= 0) return;

        // Basitleştirilmiş bloom - sadece parlak pikselleri yay
        // Not: Gerçek bloom box blur gerektirir, bu sadece simulasyon

        const threshold = bloom.threshold * 255;
        const radius = bloom.radius;

        // Parlak pikselleri bul ve yay
        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                const idx = (y * width + x) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                if (brightness > threshold) {
                    const overflow = (brightness - threshold) / 255 * bloom.intensity;

                    // Çevresine yay (basit box)
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            if (dx === 0 && dy === 0) continue;

                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > radius) continue;

                            const falloff = 1 - (dist / radius);
                            const add = overflow * falloff * 20;

                            const nIdx = ((y + dy) * width + (x + dx)) * 4;
                            data[nIdx] = clamp(data[nIdx] + add * (data[idx] / 255), 0, 255);
                            data[nIdx + 1] = clamp(data[nIdx + 1] + add * (data[idx + 1] / 255), 0, 255);
                            data[nIdx + 2] = clamp(data[nIdx + 2] + add * (data[idx + 2] / 255), 0, 255);
                        }
                    }
                }
            }
        }
    }

    /**
     * Damage efektini tetikle
     */
    triggerDamage(intensity = 0.5) {
        this.effects.DAMAGE.intensity = Math.min(1, this.effects.DAMAGE.intensity + intensity);
    }

    /**
     * Efekt ayarını değiştir
     */
    setEffect(effectName, property, value) {
        if (this.effects[effectName]) {
            this.effects[effectName][property] = value;
        }
    }

    /**
     * Tüm efektleri aç/kapat
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Tek bir efekti aç/kapat
     */
    toggleEffect(effectName) {
        if (this.effects[effectName]) {
            this.effects[effectName].enabled = !this.effects[effectName].enabled;
            return this.effects[effectName].enabled;
        }
        return false;
    }

    /**
     * Preset uygula
     */
    applyPreset(presetName) {
        switch (presetName) {
            case 'retro':
                this.effects.CRT.enabled = true;
                this.effects.CRT.scanlineIntensity = 0.2;
                this.effects.ABERRATION.enabled = true;
                this.effects.ABERRATION.intensity = 2;
                this.effects.GRAIN.enabled = true;
                this.effects.GRAIN.intensity = 0.05;
                break;

            case 'clean':
                this.effects.CRT.enabled = false;
                this.effects.ABERRATION.enabled = false;
                this.effects.GRAIN.enabled = false;
                break;

            case 'cinematic':
                this.effects.CRT.enabled = true;
                this.effects.CRT.scanlineIntensity = 0;
                this.effects.CRT.vignetteIntensity = 0.6;
                this.effects.ABERRATION.enabled = true;
                this.effects.ABERRATION.intensity = 1;
                this.effects.GRAIN.enabled = true;
                this.effects.GRAIN.intensity = 0.02;
                break;

            case 'horror':
                this.effects.CRT.enabled = true;
                this.effects.CRT.vignetteIntensity = 0.7;
                this.effects.ABERRATION.enabled = true;
                this.effects.ABERRATION.intensity = 3;
                this.effects.GRAIN.enabled = true;
                this.effects.GRAIN.intensity = 0.08;
                break;
        }
    }
}

// Yardımcı fonksiyon
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Global instance
let postProcessorInstance = null;

export function initPostProcessor() {
    postProcessorInstance = new PostProcessor();
    return postProcessorInstance;
}

export function getPostProcessor() {
    return postProcessorInstance;
}

// Kısayol fonksiyonları
export function triggerDamageEffect(intensity = 0.5) {
    if (postProcessorInstance) {
        postProcessorInstance.triggerDamage(intensity);
    }
}

export function togglePostProcessing() {
    if (postProcessorInstance) {
        return postProcessorInstance.toggle();
    }
    return false;
}

export function setPostPreset(presetName) {
    if (postProcessorInstance) {
        postProcessorInstance.applyPreset(presetName);
    }
}
