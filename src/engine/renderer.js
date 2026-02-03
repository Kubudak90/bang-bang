// Renderer - Canvas'a çizim (texture mapping ile)
// Optimized: ImageData batch rendering
// Enhanced: Fog, atmospheric lighting, ambient effects

import { SCREEN, RAYCASTER } from '../core/config.js';
import { getTexture, TEXTURE_SIZE } from './textures.js';
import { game } from '../core/game.js';

// Texture mapping için duvar tipleri
const WALL_TEXTURES = {
    1: 'brick',
    2: 'stone',
    3: 'metal',
    4: 'tech'
};

// Frame buffer - tek seferlik allocation
let frameBuffer = null;
let frameImageData = null;

// Zemin/tavan renkleri (pre-calculated)
const CEILING_COLOR = { r: 26, g: 26, b: 46 };
const FLOOR_COLOR = { r: 22, g: 33, b: 62 };

// ============================================
// FOG / ATMOSPHERE SETTINGS
// ============================================
const FOG_SETTINGS = {
    enabled: true,
    color: { r: 15, g: 20, b: 35 },  // Koyu mavi sis
    density: 0.08,                     // Sis yoğunluğu
    startDistance: 2,                  // Sis başlangıç mesafesi
    maxDistance: 15                    // Tam sis mesafesi
};

// Ambient light (ortam ışığı)
const AMBIENT_SETTINGS = {
    flicker: true,                     // Işık titrşimi
    flickerIntensity: 0.03,            // Titreşim şiddeti
    flickerSpeed: 8                    // Titreşim hızı
};

// Pre-calculated gradient lookup tables
let ceilingGradient = null;
let floorGradient = null;

/**
 * Frame buffer'ı başlat (ilk çağrıda)
 */
function initFrameBuffer(ctx) {
    if (frameImageData) return;

    frameImageData = ctx.createImageData(SCREEN.WIDTH, SCREEN.HEIGHT);
    frameBuffer = frameImageData.data;

    // Gradient lookup table'larını oluştur
    ceilingGradient = new Uint8Array(SCREEN.HEIGHT / 2 * 3);
    floorGradient = new Uint8Array(SCREEN.HEIGHT / 2 * 3);

    const halfHeight = SCREEN.HEIGHT / 2;

    // Tavan gradient'i pre-calculate
    for (let y = 0; y < halfHeight; y++) {
        const brightness = 0.1 + (y / halfHeight) * 0.3;
        const idx = y * 3;
        ceilingGradient[idx] = Math.floor(CEILING_COLOR.r * brightness);
        ceilingGradient[idx + 1] = Math.floor(CEILING_COLOR.g * brightness);
        ceilingGradient[idx + 2] = Math.floor(CEILING_COLOR.b * brightness);
    }

    // Zemin gradient'i pre-calculate
    for (let y = 0; y < halfHeight; y++) {
        const distFromCenter = y / halfHeight;
        const brightness = 0.15 + distFromCenter * 0.35;
        const idx = y * 3;
        floorGradient[idx] = Math.floor(FLOOR_COLOR.r * brightness);
        floorGradient[idx + 1] = Math.floor(FLOOR_COLOR.g * brightness);
        floorGradient[idx + 2] = Math.floor(FLOOR_COLOR.b * brightness);
    }

    console.log('🖼️ Frame buffer başlatıldı (ImageData batch rendering)');
}

// Current pitch offset (set by renderWorld)
let currentPitch = 0;

/**
 * Dünyayı render et
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} rays
 * @param {Object} map
 * @param {number} pitch - Dikey bakış offset (optional)
 */
export function renderWorld(ctx, rays, map, pitch = 0) {
    // Frame buffer'ı başlat (lazım olduğunda)
    initFrameBuffer(ctx);

    // Pitch'i kaydet
    currentPitch = pitch;

    // Zemin ve tavan (gradient lookup ile hızlı)
    renderFloorAndCeiling();

    // Duvarlar (texture mapped)
    renderWalls(rays, map);

    // Tek seferde ekrana çiz
    ctx.putImageData(frameImageData, 0, 0);
}

/**
 * Zemin ve tavan render (pre-calculated gradient ile)
 * Pitch değerine göre horizon kaydırılır
 * Fog efekti mesafeye göre uygulanır
 */
function renderFloorAndCeiling() {
    const height = SCREEN.HEIGHT;
    const width = SCREEN.WIDTH;
    const halfHeight = height / 2;

    // Pitch'e göre horizon line'ı kaydır
    const horizonY = Math.floor(halfHeight + currentPitch);

    // Tüm ekranı doldur
    for (let y = 0; y < height; y++) {
        const rowStart = y * width * 4;

        if (y < horizonY) {
            // Tavan
            const gradY = Math.floor((y / horizonY) * (halfHeight - 1));
            const clampedGradY = Math.max(0, Math.min(halfHeight - 1, gradY));
            const gradIdx = clampedGradY * 3;

            // Uzaklığa göre fog hesapla (ufka yakın = uzak)
            const distFactor = 1 - (y / horizonY);  // 0 = yakın, 1 = uzak
            let fogFactor = 0;
            if (FOG_SETTINGS.enabled) {
                fogFactor = distFactor * distFactor * 0.6;  // Quadratic falloff
            }

            let r = ceilingGradient[gradIdx];
            let g = ceilingGradient[gradIdx + 1];
            let b = ceilingGradient[gradIdx + 2];

            // Fog uygula
            if (fogFactor > 0) {
                r = Math.floor(r * (1 - fogFactor) + FOG_SETTINGS.color.r * fogFactor);
                g = Math.floor(g * (1 - fogFactor) + FOG_SETTINGS.color.g * fogFactor);
                b = Math.floor(b * (1 - fogFactor) + FOG_SETTINGS.color.b * fogFactor);
            }

            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                frameBuffer[idx] = r;
                frameBuffer[idx + 1] = g;
                frameBuffer[idx + 2] = b;
                frameBuffer[idx + 3] = 255;
            }
        } else {
            // Zemin
            const floorHeight = height - horizonY;
            const gradY = Math.floor(((y - horizonY) / floorHeight) * (halfHeight - 1));
            const clampedGradY = Math.max(0, Math.min(halfHeight - 1, gradY));
            const gradIdx = clampedGradY * 3;

            // Uzaklığa göre fog hesapla
            const distFactor = (y - horizonY) / floorHeight;  // 0 = yakın, 1 = uzak
            let fogFactor = 0;
            if (FOG_SETTINGS.enabled) {
                fogFactor = (1 - distFactor) * (1 - distFactor) * 0.5;  // Ters - uzak daha yoğun
            }

            let r = floorGradient[gradIdx];
            let g = floorGradient[gradIdx + 1];
            let b = floorGradient[gradIdx + 2];

            // Fog uygula
            if (fogFactor > 0) {
                r = Math.floor(r * (1 - fogFactor) + FOG_SETTINGS.color.r * fogFactor);
                g = Math.floor(g * (1 - fogFactor) + FOG_SETTINGS.color.g * fogFactor);
                b = Math.floor(b * (1 - fogFactor) + FOG_SETTINGS.color.b * fogFactor);
            }

            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                frameBuffer[idx] = r;
                frameBuffer[idx + 1] = g;
                frameBuffer[idx + 2] = b;
                frameBuffer[idx + 3] = 255;
            }
        }
    }
}

/**
 * Duvarları texture mapping ile render et
 * Pitch değerine göre duvarlar kaydırılır
 * Fog ve atmosferik efektler uygulanır
 */
function renderWalls(rays, map) {
    const width = SCREEN.WIDTH;
    const height = SCREEN.HEIGHT;

    // Ambient light flicker
    let ambientMod = 1.0;
    if (AMBIENT_SETTINGS.flicker) {
        const time = performance.now() / 1000;
        const flicker1 = Math.sin(time * AMBIENT_SETTINGS.flickerSpeed) * 0.5 + 0.5;
        const flicker2 = Math.sin(time * AMBIENT_SETTINGS.flickerSpeed * 1.7 + 1.3) * 0.5 + 0.5;
        ambientMod = 1 - AMBIENT_SETTINGS.flickerIntensity * (flicker1 * 0.6 + flicker2 * 0.4);
    }

    for (let x = 0; x < rays.length; x++) {
        const ray = rays[x];

        if (!ray.hit) continue;

        // Duvar yüksekliği
        const wallHeight = (RAYCASTER.WALL_HEIGHT / ray.correctedDistance) * height;

        // Ekrandaki Y koordinatları (pitch offset ile)
        const drawStart = Math.floor((height - wallHeight) / 2 + currentPitch);
        const drawEnd = Math.floor((height + wallHeight) / 2 + currentPitch);

        // Hangi texture kullanılacak
        const tileValue = map ? map.getTile(ray.mapX, ray.mapY) : 1;
        const textureName = WALL_TEXTURES[tileValue] || 'brick';
        const texture = getTexture(textureName);
        const texData = texture.data;

        // Texture X koordinatı
        let texX = Math.floor(ray.wallX * TEXTURE_SIZE);
        if (texX >= TEXTURE_SIZE) texX = TEXTURE_SIZE - 1;

        // Mesafe bazlı karartma
        const baseBrightness = Math.max(0.15, 1 - ray.correctedDistance / RAYCASTER.MAX_DEPTH);

        // Yön bazlı ek karartma (yan duvarlar daha koyu)
        const sideBrightness = (ray.side === 1) ? 0.8 : 1.0;

        // Ambient flicker uygula
        const finalBrightness = baseBrightness * sideBrightness * ambientMod;

        // Fog hesapla
        let fogFactor = 0;
        if (FOG_SETTINGS.enabled) {
            const fogDist = Math.max(0, ray.correctedDistance - FOG_SETTINGS.startDistance);
            const fogRange = FOG_SETTINGS.maxDistance - FOG_SETTINGS.startDistance;
            fogFactor = Math.min(1, (fogDist / fogRange) * FOG_SETTINGS.density * 10);
        }

        // Dikey texture slice çiz
        const drawHeight = drawEnd - drawStart;
        const yStart = Math.max(0, drawStart);
        const yEnd = Math.min(height, drawEnd);

        for (let y = yStart; y < yEnd; y++) {
            // Texture Y koordinatını hesapla
            const d = y - drawStart;
            const texY = Math.floor((d / drawHeight) * TEXTURE_SIZE);

            // Texture'dan renk al
            const texIdx = (texY * TEXTURE_SIZE + texX) * 4;
            let r = Math.floor(texData[texIdx] * finalBrightness);
            let g = Math.floor(texData[texIdx + 1] * finalBrightness);
            let b = Math.floor(texData[texIdx + 2] * finalBrightness);

            // Fog karıştır (lerp towards fog color)
            if (fogFactor > 0) {
                r = Math.floor(r * (1 - fogFactor) + FOG_SETTINGS.color.r * fogFactor);
                g = Math.floor(g * (1 - fogFactor) + FOG_SETTINGS.color.g * fogFactor);
                b = Math.floor(b * (1 - fogFactor) + FOG_SETTINGS.color.b * fogFactor);
            }

            // Frame buffer'a yaz
            const fbIdx = (y * width + x) * 4;
            frameBuffer[fbIdx] = r;
            frameBuffer[fbIdx + 1] = g;
            frameBuffer[fbIdx + 2] = b;
            frameBuffer[fbIdx + 3] = 255;
        }
    }
}

/**
 * Ekranı temizle
 */
export function clearScreen(ctx) {
    // ImageData ile render ettiğimiz için bu artık gerekli değil
    // Ama diğer modüller kullanıyor olabilir
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
}

// ============================================
// FOG / ATMOSPHERE CONTROLS
// ============================================

/**
 * Fog'u aç/kapat
 */
export function setFogEnabled(enabled) {
    FOG_SETTINGS.enabled = enabled;
}

/**
 * Fog rengini ayarla
 */
export function setFogColor(r, g, b) {
    FOG_SETTINGS.color.r = r;
    FOG_SETTINGS.color.g = g;
    FOG_SETTINGS.color.b = b;
}

/**
 * Fog yoğunluğunu ayarla
 */
export function setFogDensity(density) {
    FOG_SETTINGS.density = Math.max(0, Math.min(1, density));
}

/**
 * Ambient flicker'ı aç/kapat
 */
export function setAmbientFlicker(enabled) {
    AMBIENT_SETTINGS.flicker = enabled;
}

/**
 * Fog ayarlarını al (debug için)
 */
export function getFogSettings() {
    return { ...FOG_SETTINGS };
}

/**
 * Level'e göre atmosfer ayarla
 * Farklı level'lar farklı atmosfere sahip olabilir
 */
export function setAtmospherePreset(preset) {
    switch (preset) {
        case 'normal':
            FOG_SETTINGS.enabled = true;
            FOG_SETTINGS.color = { r: 15, g: 20, b: 35 };
            FOG_SETTINGS.density = 0.08;
            AMBIENT_SETTINGS.flicker = true;
            AMBIENT_SETTINGS.flickerIntensity = 0.03;
            break;

        case 'dungeon':
            FOG_SETTINGS.enabled = true;
            FOG_SETTINGS.color = { r: 10, g: 10, b: 15 };
            FOG_SETTINGS.density = 0.12;
            AMBIENT_SETTINGS.flicker = true;
            AMBIENT_SETTINGS.flickerIntensity = 0.06;
            break;

        case 'hell':
            FOG_SETTINGS.enabled = true;
            FOG_SETTINGS.color = { r: 40, g: 10, b: 5 };
            FOG_SETTINGS.density = 0.1;
            AMBIENT_SETTINGS.flicker = true;
            AMBIENT_SETTINGS.flickerIntensity = 0.08;
            break;

        case 'tech':
            FOG_SETTINGS.enabled = true;
            FOG_SETTINGS.color = { r: 10, g: 25, b: 35 };
            FOG_SETTINGS.density = 0.06;
            AMBIENT_SETTINGS.flicker = false;
            break;

        case 'clear':
            FOG_SETTINGS.enabled = false;
            AMBIENT_SETTINGS.flicker = false;
            break;
    }
}
