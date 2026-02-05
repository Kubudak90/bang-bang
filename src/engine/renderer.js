// Renderer - Canvas'a çizim (texture mapping ile)
// Optimized: ImageData batch rendering + Dynamic lighting

import { SCREEN, RAYCASTER } from '../core/config.js';
import { getTexture, TEXTURE_SIZE } from './textures.js';
import { getLightingSystem } from './lighting.js';
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
            const r = ceilingGradient[gradIdx];
            const g = ceilingGradient[gradIdx + 1];
            const b = ceilingGradient[gradIdx + 2];

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
            const r = floorGradient[gradIdx];
            const g = floorGradient[gradIdx + 1];
            const b = floorGradient[gradIdx + 2];

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
 * Dynamic lighting entegrasyonu
 */
function renderWalls(rays, map) {
    const width = SCREEN.WIDTH;
    const height = SCREEN.HEIGHT;

    // Işık sistemi
    const lighting = getLightingSystem();
    const player = game.player;
    const playerX = player ? player.x : 0;
    const playerY = player ? player.y : 0;
    const playerAngle = player ? player.angle : 0;

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
        const distBrightness = Math.max(0.15, 1 - ray.correctedDistance / RAYCASTER.MAX_DEPTH);

        // Yön bazlı ek karartma
        const sideBrightness = (ray.side === 1) ? 0.85 : 1.0;

        // Dinamik ışık hesaplaması (duvarın dünya koordinatı)
        let dynamicLight = 0;
        let lightColorMod = { r: 1, g: 1, b: 1 };

        if (lighting && lighting.getLightCount() > 0) {
            // Duvarın isabet ettiği dünya koordinatı
            const wallWorldX = ray.side === 0
                ? ray.mapX + (ray.stepX > 0 ? 0 : 1)
                : playerX + ray.correctedDistance * Math.cos(ray.angle);
            const wallWorldY = ray.side === 1
                ? ray.mapY + (ray.stepY > 0 ? 0 : 1)
                : playerY + ray.correctedDistance * Math.sin(ray.angle);

            const lightInfo = lighting.calculateLightAt(
                wallWorldX, wallWorldY,
                playerX, playerY, playerAngle
            );

            dynamicLight = lightInfo.intensity;

            // Işık rengi etkisi (subtle)
            if (dynamicLight > 0.2) {
                lightColorMod.r = 1 + (lightInfo.color.r / 255 - 0.5) * 0.3;
                lightColorMod.g = 1 + (lightInfo.color.g / 255 - 0.5) * 0.3;
                lightColorMod.b = 1 + (lightInfo.color.b / 255 - 0.5) * 0.3;
            }
        } else {
            // Işık sistemi yoksa veya ışık yoksa varsayılan ambient
            dynamicLight = 0.25;
        }

        // Final brightness = distance * side * dynamic light
        const finalBrightness = distBrightness * sideBrightness * (0.5 + dynamicLight * 0.8);

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
            let r = Math.floor(texData[texIdx] * finalBrightness * lightColorMod.r);
            let g = Math.floor(texData[texIdx + 1] * finalBrightness * lightColorMod.g);
            let b = Math.floor(texData[texIdx + 2] * finalBrightness * lightColorMod.b);

            // Clamp
            r = Math.min(255, Math.max(0, r));
            g = Math.min(255, Math.max(0, g));
            b = Math.min(255, Math.max(0, b));

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
