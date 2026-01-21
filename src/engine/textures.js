// Textures - procedural texture generation ve yönetimi

export const TEXTURE_SIZE = 64;

// Texture storage
const textures = {};

/**
 * Tüm texture'ları oluştur
 */
export function initTextures() {
    textures.brick = createBrickTexture();
    textures.stone = createStoneTexture();
    textures.metal = createMetalTexture();
    textures.tech = createTechTexture();

    console.log('🎨 Texture\'lar yüklendi');
}

/**
 * Texture al
 */
export function getTexture(name) {
    return textures[name] || textures.brick;
}

/**
 * Tüm texture'ları döndür
 */
export function getAllTextures() {
    return textures;
}

// ============================================
// PROCEDURAL TEXTURE GENERATORS
// ============================================

/**
 * Tuğla duvar texture'ı
 */
function createBrickTexture() {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const brickColor = { r: 139, g: 69, b: 50 };
    const mortarColor = { r: 80, g: 80, b: 80 };
    const brickHeight = 8;
    const brickWidth = 16;

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            // Hangi tuğla satırındayız
            const row = Math.floor(y / brickHeight);
            // Offset: her satırda tuğlalar kaydırılır
            const offset = (row % 2) * (brickWidth / 2);

            // Harç mı tuğla mı?
            const isMortar = (y % brickHeight === 0) ||
                            ((x + offset) % brickWidth === 0);

            let color = isMortar ? mortarColor : brickColor;

            // Tuğlaya variation ekle
            if (!isMortar) {
                const noise = (Math.random() - 0.5) * 20;
                color = {
                    r: clamp(color.r + noise, 0, 255),
                    g: clamp(color.g + noise * 0.5, 0, 255),
                    b: clamp(color.b + noise * 0.3, 0, 255)
                };
            }

            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

/**
 * Taş duvar texture'ı
 */
function createStoneTexture() {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 100, g: 100, b: 110 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            // Perlin-ish noise
            const noise1 = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 30;
            const noise2 = Math.sin(x * 0.7 + y * 0.5) * 15;
            const noise3 = (Math.random() - 0.5) * 10;

            const variation = noise1 + noise2 + noise3;

            data[idx] = clamp(baseColor.r + variation, 0, 255);
            data[idx + 1] = clamp(baseColor.g + variation, 0, 255);
            data[idx + 2] = clamp(baseColor.b + variation, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

/**
 * Metal panel texture'ı
 */
function createMetalTexture() {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 70, g: 80, b: 90 };
    const lineColor = { r: 50, g: 55, b: 65 };
    const rivetColor = { r: 90, g: 100, b: 110 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...baseColor };

            // Yatay çizgiler (panel birleşim yerleri)
            if (y % 16 === 0 || y % 16 === 1) {
                color = lineColor;
            }

            // Dikey çizgiler
            if (x % 32 === 0) {
                color = lineColor;
            }

            // Perçinler (köşelerde)
            const rivetSpacing = 32;
            const rx = x % rivetSpacing;
            const ry = y % rivetSpacing;
            if ((rx < 3 || rx > rivetSpacing - 4) && (ry < 3 || ry > rivetSpacing - 4)) {
                const distFromCorner = Math.min(rx, rivetSpacing - rx, ry, rivetSpacing - ry);
                if (distFromCorner < 2) {
                    color = rivetColor;
                }
            }

            // Hafif noise
            const noise = (Math.random() - 0.5) * 8;

            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

/**
 * Tech/Sci-fi panel texture'ı
 */
function createTechTexture() {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const bgColor = { r: 30, g: 35, b: 50 };
    const lineColor = { r: 60, g: 180, b: 220 };
    const dimLineColor = { r: 40, g: 80, b: 100 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...bgColor };

            // Grid pattern
            if (x % 16 === 0 || y % 16 === 0) {
                color = dimLineColor;
            }

            // Parlak çizgiler (kenarlar)
            if (x === 0 || x === TEXTURE_SIZE - 1 || y === 0 || y === TEXTURE_SIZE - 1) {
                color = lineColor;
            }

            // Orta dekoratif element
            const cx = TEXTURE_SIZE / 2;
            const cy = TEXTURE_SIZE / 2;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

            if (dist > 8 && dist < 12) {
                color = lineColor;
            }

            // Köşe markerları
            if ((x < 8 && y < 8) || (x > 55 && y < 8) ||
                (x < 8 && y > 55) || (x > 55 && y > 55)) {
                if ((x + y) % 4 < 2) {
                    color = dimLineColor;
                }
            }

            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// HELPERS
// ============================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Raw pixel data'dan ImageData benzeri obje oluştur
 */
function createImageFromData(data) {
    return {
        data,
        width: TEXTURE_SIZE,
        height: TEXTURE_SIZE
    };
}
