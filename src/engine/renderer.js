// Renderer - Canvas'a çizim (texture mapping ile)
// Optimized: ImageData batch rendering

import { SCREEN, RAYCASTER } from '../core/config.js';
import { getTexture, TEXTURE_SIZE } from './textures.js';

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

/**
 * Dünyayı render et
 */
export function renderWorld(ctx, rays, map) {
    // Frame buffer'ı başlat (lazım olduğunda)
    initFrameBuffer(ctx);

    // Zemin ve tavan (gradient lookup ile hızlı)
    renderFloorAndCeiling();

    // Duvarlar (texture mapped)
    renderWalls(rays, map);

    // Tek seferde ekrana çiz
    ctx.putImageData(frameImageData, 0, 0);
}

/**
 * Zemin ve tavan render (pre-calculated gradient ile)
 */
function renderFloorAndCeiling() {
    const halfHeight = SCREEN.HEIGHT / 2;
    const width = SCREEN.WIDTH;

    // Tavan
    for (let y = 0; y < halfHeight; y++) {
        const gradIdx = y * 3;
        const r = ceilingGradient[gradIdx];
        const g = ceilingGradient[gradIdx + 1];
        const b = ceilingGradient[gradIdx + 2];

        const rowStart = y * width * 4;
        for (let x = 0; x < width; x++) {
            const idx = rowStart + x * 4;
            frameBuffer[idx] = r;
            frameBuffer[idx + 1] = g;
            frameBuffer[idx + 2] = b;
            frameBuffer[idx + 3] = 255;
        }
    }

    // Zemin
    for (let y = halfHeight; y < SCREEN.HEIGHT; y++) {
        const gradIdx = (y - halfHeight) * 3;
        const r = floorGradient[gradIdx];
        const g = floorGradient[gradIdx + 1];
        const b = floorGradient[gradIdx + 2];

        const rowStart = y * width * 4;
        for (let x = 0; x < width; x++) {
            const idx = rowStart + x * 4;
            frameBuffer[idx] = r;
            frameBuffer[idx + 1] = g;
            frameBuffer[idx + 2] = b;
            frameBuffer[idx + 3] = 255;
        }
    }
}

/**
 * Duvarları texture mapping ile render et
 */
function renderWalls(rays, map) {
    const width = SCREEN.WIDTH;
    const height = SCREEN.HEIGHT;

    for (let x = 0; x < rays.length; x++) {
        const ray = rays[x];

        if (!ray.hit) continue;

        // Duvar yüksekliği
        const wallHeight = (RAYCASTER.WALL_HEIGHT / ray.correctedDistance) * height;

        // Ekrandaki Y koordinatları
        const drawStart = Math.floor((height - wallHeight) / 2);
        const drawEnd = Math.floor((height + wallHeight) / 2);

        // Hangi texture kullanılacak
        const tileValue = map ? map.getTile(ray.mapX, ray.mapY) : 1;
        const textureName = WALL_TEXTURES[tileValue] || 'brick';
        const texture = getTexture(textureName);
        const texData = texture.data;

        // Texture X koordinatı
        let texX = Math.floor(ray.wallX * TEXTURE_SIZE);
        if (texX >= TEXTURE_SIZE) texX = TEXTURE_SIZE - 1;

        // Mesafe bazlı karartma
        const brightness = Math.max(0.15, 1 - ray.correctedDistance / RAYCASTER.MAX_DEPTH);

        // Yön bazlı ek karartma
        const sideBrightness = (ray.side === 1) ? 0.85 : 1.0;
        const finalBrightness = brightness * sideBrightness;

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
            const r = Math.floor(texData[texIdx] * finalBrightness);
            const g = Math.floor(texData[texIdx + 1] * finalBrightness);
            const b = Math.floor(texData[texIdx + 2] * finalBrightness);

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
