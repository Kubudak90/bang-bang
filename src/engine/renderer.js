// Renderer - Canvas'a çizim (texture mapping ile)
// Optimized: ImageData batch rendering + Dynamic lighting
// Enhanced: Floor/ceiling texture mapping

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

// Zemin ve tavan texture'ları
const FLOOR_TEXTURE = 'floor_tile';
const CEILING_TEXTURE = 'tech';

// Texture mapping kontrolü
let useTexturedFloors = true; // true = texture, false = gradient

// Frame buffer - tek seferlik allocation
let frameBuffer = null;
let frameImageData = null;

// Z-buffer (particle ve sprite occlusion için)
let zBuffer = null;

// Zemin/tavan renkleri (gradient fallback)
const CEILING_COLOR = { r: 26, g: 26, b: 46 };
const FLOOR_COLOR = { r: 22, g: 33, b: 62 };

// Pre-calculated gradient lookup tables
let ceilingGradient = null;
let floorGradient = null;

// Cached texture data for floor/ceiling
let floorTexData = null;
let ceilingTexData = null;

// Player position cache (for floor/ceiling rendering)
let cachedPlayerX = 0;
let cachedPlayerY = 0;
let cachedPlayerAngle = 0;

/**
 * Frame buffer'ı başlat (ilk çağrıda)
 */
function initFrameBuffer(ctx) {
    if (frameImageData) return;

    frameImageData = ctx.createImageData(SCREEN.WIDTH, SCREEN.HEIGHT);
    frameBuffer = frameImageData.data;
    zBuffer = new Float32Array(SCREEN.WIDTH);

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

    console.log('🖼️ Frame buffer başlatıldı (texture mapped floor/ceiling)');
}

/**
 * Floor/ceiling texture'larını cache'le
 */
function cacheFloorCeilingTextures() {
    if (!floorTexData) {
        const floorTex = getTexture(FLOOR_TEXTURE);
        floorTexData = floorTex ? floorTex.data : null;
    }
    if (!ceilingTexData) {
        const ceilingTex = getTexture(CEILING_TEXTURE);
        ceilingTexData = ceilingTex ? ceilingTex.data : null;
    }
}

// Current pitch offset (set by renderWorld)
let currentPitch = 0;

/**
 * Z-Buffer'ı dışarı ver (sprite occlusion için)
 */
export function getZBuffer() {
    return zBuffer;
}

/**
 * Texture mapping'i aç/kapat
 */
export function toggleTexturedFloors() {
    useTexturedFloors = !useTexturedFloors;
    console.log(`🏠 Texture mapped floors: ${useTexturedFloors ? 'ON' : 'OFF'}`);
    return useTexturedFloors;
}

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

    // Floor/ceiling texture'larını cache'le
    cacheFloorCeilingTextures();

    // Pitch'i kaydet
    currentPitch = pitch;

    // Oyuncu pozisyonunu cache'le
    const player = game.player;
    if (player) {
        cachedPlayerX = player.x;
        cachedPlayerY = player.y;
        cachedPlayerAngle = player.angle;
    }

    // Z-buffer'ı temizle
    for (let i = 0; i < SCREEN.WIDTH; i++) {
        zBuffer[i] = Infinity;
    }

    // Zemin ve tavan (texture mapped veya gradient)
    if (useTexturedFloors && floorTexData && ceilingTexData) {
        renderTexturedFloorAndCeiling(rays);
    } else {
        renderGradientFloorAndCeiling();
    }

    // Duvarlar (texture mapped)
    renderWalls(rays, map);

    // Tek seferde ekrana çiz
    ctx.putImageData(frameImageData, 0, 0);
}

/**
 * Zemin ve tavan render (texture mapping ile)
 * Horizontal raycasting tekniği kullanır
 */
function renderTexturedFloorAndCeiling(rays) {
    const width = SCREEN.WIDTH;
    const height = SCREEN.HEIGHT;
    const halfHeight = height / 2;

    // Pitch'e göre horizon line'ı kaydır
    const horizonY = Math.floor(halfHeight + currentPitch);

    // FOV hesaplamaları
    const fov = RAYCASTER.FOV;
    const halfFov = fov / 2;

    // Işık sistemi
    const lighting = getLightingSystem();

    // Her satır için zemin/tavan render
    for (let y = 0; y < height; y++) {
        const rowStart = y * width * 4;

        // Horizon çizgisine göre mesafe hesapla
        // Bu formül perspektif projeksiyon için
        const rowDistance = y < horizonY
            ? halfHeight / (horizonY - y)  // Tavan
            : halfHeight / (y - horizonY); // Zemin

        // Çok uzak pikselleri atla (performans)
        if (rowDistance > RAYCASTER.MAX_DEPTH * 2) {
            // Gradient fallback
            const isCeiling = y < horizonY;
            const gradY = isCeiling
                ? Math.floor((y / Math.max(1, horizonY)) * (halfHeight - 1))
                : Math.floor(((y - horizonY) / Math.max(1, height - horizonY)) * (halfHeight - 1));
            const clampedGradY = Math.max(0, Math.min(halfHeight - 1, gradY));
            const gradIdx = clampedGradY * 3;
            const grad = isCeiling ? ceilingGradient : floorGradient;

            for (let x = 0; x < width; x++) {
                const idx = rowStart + x * 4;
                frameBuffer[idx] = grad[gradIdx];
                frameBuffer[idx + 1] = grad[gradIdx + 1];
                frameBuffer[idx + 2] = grad[gradIdx + 2];
                frameBuffer[idx + 3] = 255;
            }
            continue;
        }

        // Mesafe bazlı karartma
        const brightness = Math.max(0.08, 1 - rowDistance / RAYCASTER.MAX_DEPTH);

        // Hangi texture kullanılacak
        const texData = y < horizonY ? ceilingTexData : floorTexData;

        // Her sütun için texture koordinatı hesapla
        for (let x = 0; x < width; x++) {
            // Ray açısı hesapla (ekran X pozisyonuna göre)
            const rayAngle = cachedPlayerAngle - halfFov + (x / width) * fov;

            // Dünya koordinatlarını hesapla
            const floorX = cachedPlayerX + rowDistance * Math.cos(rayAngle);
            const floorY = cachedPlayerY + rowDistance * Math.sin(rayAngle);

            // Texture koordinatları (tile'a göre wrap)
            const texX = Math.floor((floorX * TEXTURE_SIZE) % TEXTURE_SIZE);
            const texY = Math.floor((floorY * TEXTURE_SIZE) % TEXTURE_SIZE);

            // Negatif modulo düzeltmesi
            const finalTexX = texX < 0 ? texX + TEXTURE_SIZE : texX;
            const finalTexY = texY < 0 ? texY + TEXTURE_SIZE : texY;

            // Texture'dan renk al
            const texIdx = (finalTexY * TEXTURE_SIZE + finalTexX) * 4;

            // Dinamik ışık hesaplaması (opsiyonel, performans için basitleştirilmiş)
            let lightMult = 1.0;
            if (lighting && lighting.getLightCount() > 0) {
                // Sadece yakın pikseller için ışık hesapla (performans)
                if (rowDistance < 5) {
                    const lightInfo = lighting.calculateLightAt(
                        floorX, floorY,
                        cachedPlayerX, cachedPlayerY, cachedPlayerAngle
                    );
                    lightMult = 0.5 + lightInfo.intensity * 0.7;
                } else {
                    lightMult = 0.7; // Varsayılan ambient
                }
            } else {
                lightMult = 0.8;
            }

            // Final renk
            const finalBrightness = brightness * lightMult;
            let r = Math.floor(texData[texIdx] * finalBrightness);
            let g = Math.floor(texData[texIdx + 1] * finalBrightness);
            let b = Math.floor(texData[texIdx + 2] * finalBrightness);

            // Clamp
            r = Math.min(255, Math.max(0, r));
            g = Math.min(255, Math.max(0, g));
            b = Math.min(255, Math.max(0, b));

            // Frame buffer'a yaz
            const fbIdx = rowStart + x * 4;
            frameBuffer[fbIdx] = r;
            frameBuffer[fbIdx + 1] = g;
            frameBuffer[fbIdx + 2] = b;
            frameBuffer[fbIdx + 3] = 255;
        }
    }
}

/**
 * Zemin ve tavan render (gradient ile - fallback/performans modu)
 */
function renderGradientFloorAndCeiling() {
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
            const gradY = Math.floor((y / Math.max(1, horizonY)) * (halfHeight - 1));
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
            const gradY = Math.floor(((y - horizonY) / Math.max(1, floorHeight)) * (halfHeight - 1));
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

        // Z-buffer'a kaydet
        zBuffer[x] = ray.correctedDistance;

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
