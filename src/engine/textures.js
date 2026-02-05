// Textures - Geliştirilmiş procedural texture generation
// Seeded random ile tutarlı texture'lar, 128x128 çözünürlük

export const TEXTURE_SIZE = 128;

// Texture storage
const textures = {};
const normalMaps = {};

// Global seed - oyun başında set edilir
let globalSeed = 12345;

/**
 * Seeded random number generator (Mulberry32)
 * Aynı seed = aynı texture, her zaman
 */
function createSeededRandom(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/**
 * Simplex-like noise for natural textures
 */
function createNoise2D(random) {
    // Permutation table
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

    const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

    return function(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        const u = fade(xf);
        const v = fade(yf);

        const aa = perm[perm[X] + Y] % 8;
        const ab = perm[perm[X] + Y + 1] % 8;
        const ba = perm[perm[X + 1] + Y] % 8;
        const bb = perm[perm[X + 1] + Y + 1] % 8;

        const x1 = lerp(dot(grad[aa], xf, yf), dot(grad[ba], xf - 1, yf), u);
        const x2 = lerp(dot(grad[ab], xf, yf - 1), dot(grad[bb], xf - 1, yf - 1), u);

        return lerp(x1, x2, v);
    };
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function dot(g, x, y) { return g[0] * x + g[1] * y; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

/**
 * Fractal Brownian Motion - doğal görünüm için
 */
function fbm(noise, x, y, octaves = 4) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise(x * frequency, y * frequency);
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / maxValue;
}

/**
 * Global seed'i ayarla
 */
export function setTextureSeed(seed) {
    globalSeed = seed;
}

/**
 * Tüm texture'ları oluştur
 */
export function initTextures() {
    const startTime = performance.now();

    // Ana texture'lar
    textures.brick = createBrickTexture();
    textures.brick_mossy = createBrickMossyTexture();
    textures.brick_damaged = createBrickDamagedTexture();

    textures.stone = createStoneTexture();
    textures.stone_carved = createStoneCavedTexture();
    textures.stone_ancient = createStoneAncientTexture();

    textures.metal = createMetalTexture();
    textures.metal_rusted = createMetalRustedTexture();
    textures.metal_tech = createMetalTechTexture();

    textures.wood = createWoodTexture();
    textures.wood_planks = createWoodPlanksTexture();
    textures.wood_crate = createWoodCrateTexture();

    textures.concrete = createConcreteTexture();
    textures.concrete_cracked = createConcreteCrackedTexture();

    textures.tech = createTechTexture();
    textures.tech_screen = createTechScreenTexture();
    textures.tech_warning = createTechWarningTexture();

    textures.door_metal = createDoorMetalTexture();
    textures.door_wood = createDoorWoodTexture();

    // Özel texture'lar
    textures.lava = createLavaTexture();
    textures.water = createWaterTexture();
    textures.flesh = createFleshTexture();

    // Zemin texture'ları
    textures.floor_tile = createFloorTileTexture();
    textures.floor_stone = createFloorStoneTexture();
    textures.floor_metal = createFloorMetalTexture();

    const elapsed = (performance.now() - startTime).toFixed(1);
    console.log(`🎨 ${Object.keys(textures).length} texture yüklendi (${elapsed}ms)`);
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

/**
 * Texture listesini döndür
 */
export function getTextureList() {
    return Object.keys(textures);
}

// ============================================
// BRICK TEXTURES
// ============================================

function createBrickTexture() {
    const random = createSeededRandom(globalSeed + 1);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const brickColor = { r: 156, g: 82, b: 59 };
    const mortarColor = { r: 90, g: 85, b: 80 };
    const brickHeight = 16;
    const brickWidth = 32;

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const row = Math.floor(y / brickHeight);
            const offset = (row % 2) * (brickWidth / 2);

            const localY = y % brickHeight;
            const localX = (x + offset) % brickWidth;

            // Harç kontrolü (2 pixel kalınlık)
            const isMortar = localY < 2 || localX < 2;

            let color;
            if (isMortar) {
                const noise = (random() - 0.5) * 15;
                color = {
                    r: clamp(mortarColor.r + noise, 0, 255),
                    g: clamp(mortarColor.g + noise, 0, 255),
                    b: clamp(mortarColor.b + noise, 0, 255)
                };
            } else {
                // Her tuğla için benzersiz renk varyasyonu
                const brickId = row * 10 + Math.floor((x + offset) / brickWidth);
                const brickRandom = createSeededRandom(globalSeed + brickId * 100);
                const baseVariation = (brickRandom() - 0.5) * 40;
                const pixelNoise = (random() - 0.5) * 15;

                color = {
                    r: clamp(brickColor.r + baseVariation + pixelNoise, 0, 255),
                    g: clamp(brickColor.g + baseVariation * 0.6 + pixelNoise * 0.5, 0, 255),
                    b: clamp(brickColor.b + baseVariation * 0.4 + pixelNoise * 0.3, 0, 255)
                };

                // Kenar karartma (bevel efekti)
                if (localY === 2 || localX === 2) {
                    color.r = clamp(color.r * 1.1, 0, 255);
                    color.g = clamp(color.g * 1.1, 0, 255);
                    color.b = clamp(color.b * 1.1, 0, 255);
                }
                if (localY === brickHeight - 1 || localX === brickWidth - 1) {
                    color.r *= 0.85;
                    color.g *= 0.85;
                    color.b *= 0.85;
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

function createBrickMossyTexture() {
    const random = createSeededRandom(globalSeed + 2);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const brickColor = { r: 140, g: 75, b: 55 };
    const mortarColor = { r: 75, g: 80, b: 70 };
    const mossColor = { r: 45, g: 85, b: 40 };
    const brickHeight = 16;
    const brickWidth = 32;

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const row = Math.floor(y / brickHeight);
            const offset = (row % 2) * (brickWidth / 2);
            const localY = y % brickHeight;
            const localX = (x + offset) % brickWidth;
            const isMortar = localY < 2 || localX < 2;

            let color = isMortar ? { ...mortarColor } : { ...brickColor };

            // Yosun overlay (alt kısımda daha yoğun)
            const mossIntensity = fbm(noise, x * 0.05, y * 0.05, 3);
            const heightFactor = y / TEXTURE_SIZE;
            const mossFactor = clamp((mossIntensity + 0.3) * heightFactor * 1.5, 0, 0.7);

            if (mossFactor > 0.2) {
                color.r = lerp(color.r, mossColor.r, mossFactor);
                color.g = lerp(color.g, mossColor.g, mossFactor);
                color.b = lerp(color.b, mossColor.b, mossFactor);
            }

            // Noise
            const pixelNoise = (random() - 0.5) * 12;
            data[idx] = clamp(color.r + pixelNoise, 0, 255);
            data[idx + 1] = clamp(color.g + pixelNoise, 0, 255);
            data[idx + 2] = clamp(color.b + pixelNoise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createBrickDamagedTexture() {
    const random = createSeededRandom(globalSeed + 3);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const brickColor = { r: 145, g: 78, b: 55 };
    const mortarColor = { r: 85, g: 80, b: 75 };
    const damageColor = { r: 50, g: 45, b: 40 };
    const brickHeight = 16;
    const brickWidth = 32;

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const row = Math.floor(y / brickHeight);
            const offset = (row % 2) * (brickWidth / 2);
            const localY = y % brickHeight;
            const localX = (x + offset) % brickWidth;
            const isMortar = localY < 2 || localX < 2;

            let color = isMortar ? { ...mortarColor } : { ...brickColor };

            // Hasar (çatlaklar ve eksik parçalar)
            const damageNoise = fbm(noise, x * 0.08, y * 0.08, 4);
            if (damageNoise > 0.35) {
                const damageFactor = (damageNoise - 0.35) * 3;
                color.r = lerp(color.r, damageColor.r, clamp(damageFactor, 0, 0.8));
                color.g = lerp(color.g, damageColor.g, clamp(damageFactor, 0, 0.8));
                color.b = lerp(color.b, damageColor.b, clamp(damageFactor, 0, 0.8));
            }

            const pixelNoise = (random() - 0.5) * 15;
            data[idx] = clamp(color.r + pixelNoise, 0, 255);
            data[idx + 1] = clamp(color.g + pixelNoise, 0, 255);
            data[idx + 2] = clamp(color.b + pixelNoise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// STONE TEXTURES
// ============================================

function createStoneTexture() {
    const random = createSeededRandom(globalSeed + 10);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 115, g: 115, b: 125 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            // Multi-octave noise
            const n = fbm(noise, x * 0.04, y * 0.04, 5) * 40;
            const detail = (random() - 0.5) * 10;

            data[idx] = clamp(baseColor.r + n + detail, 0, 255);
            data[idx + 1] = clamp(baseColor.g + n + detail, 0, 255);
            data[idx + 2] = clamp(baseColor.b + n * 1.1 + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createStoneCavedTexture() {
    const random = createSeededRandom(globalSeed + 11);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 120, g: 115, b: 110 };
    const caveColor = { r: 70, g: 65, b: 60 };

    // Carved pattern - runes/symbols
    const patterns = [
        { cx: 32, cy: 32, size: 20 },
        { cx: 96, cy: 32, size: 15 },
        { cx: 32, cy: 96, size: 15 },
        { cx: 96, cy: 96, size: 20 },
        { cx: 64, cy: 64, size: 25 }
    ];

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const n = fbm(noise, x * 0.03, y * 0.03, 4) * 30;
            let color = { ...baseColor };

            // Check if in carved area
            for (const p of patterns) {
                const dist = Math.sqrt((x - p.cx) ** 2 + (y - p.cy) ** 2);
                if (dist < p.size) {
                    // Concentric circles pattern
                    const ring = Math.sin(dist * 0.8) * 0.5 + 0.5;
                    if (ring > 0.6) {
                        color = {
                            r: lerp(color.r, caveColor.r, 0.6),
                            g: lerp(color.g, caveColor.g, 0.6),
                            b: lerp(color.b, caveColor.b, 0.6)
                        };
                    }
                }
            }

            const detail = (random() - 0.5) * 8;
            data[idx] = clamp(color.r + n + detail, 0, 255);
            data[idx + 1] = clamp(color.g + n + detail, 0, 255);
            data[idx + 2] = clamp(color.b + n + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createStoneAncientTexture() {
    const random = createSeededRandom(globalSeed + 12);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 100, g: 95, b: 85 };
    const stainColor = { r: 60, g: 55, b: 45 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const n = fbm(noise, x * 0.025, y * 0.025, 6) * 35;
            let color = { ...baseColor };

            // Age stains
            const stainNoise = fbm(noise, x * 0.06 + 100, y * 0.06, 3);
            if (stainNoise > 0.2) {
                const stainFactor = (stainNoise - 0.2) * 1.5;
                color.r = lerp(color.r, stainColor.r, clamp(stainFactor, 0, 0.5));
                color.g = lerp(color.g, stainColor.g, clamp(stainFactor, 0, 0.5));
                color.b = lerp(color.b, stainColor.b, clamp(stainFactor, 0, 0.5));
            }

            const detail = (random() - 0.5) * 12;
            data[idx] = clamp(color.r + n + detail, 0, 255);
            data[idx + 1] = clamp(color.g + n + detail, 0, 255);
            data[idx + 2] = clamp(color.b + n + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// METAL TEXTURES
// ============================================

function createMetalTexture() {
    const random = createSeededRandom(globalSeed + 20);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 85, g: 95, b: 105 };
    const lineColor = { r: 55, g: 60, b: 70 };
    const highlightColor = { r: 120, g: 130, b: 140 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...baseColor };

            // Brushed metal effect (horizontal lines)
            const brushNoise = Math.sin(y * 2.5 + random() * 0.5) * 8;

            // Panel seams
            if (y % 32 < 2) color = { ...lineColor };
            if (x % 64 === 0 || x % 64 === 1) color = { ...lineColor };

            // Rivets
            const rivetSpacing = 32;
            for (let ry = 8; ry < TEXTURE_SIZE; ry += rivetSpacing) {
                for (let rx = 8; rx < TEXTURE_SIZE; rx += rivetSpacing) {
                    const dist = Math.sqrt((x - rx) ** 2 + (y - ry) ** 2);
                    if (dist < 3) {
                        color = { ...highlightColor };
                        if (dist < 1.5) {
                            color.r += 20;
                            color.g += 20;
                            color.b += 20;
                        }
                    }
                }
            }

            const noise = (random() - 0.5) * 6;
            data[idx] = clamp(color.r + brushNoise + noise, 0, 255);
            data[idx + 1] = clamp(color.g + brushNoise + noise, 0, 255);
            data[idx + 2] = clamp(color.b + brushNoise + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createMetalRustedTexture() {
    const random = createSeededRandom(globalSeed + 21);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const metalColor = { r: 75, g: 85, b: 90 };
    const rustColor = { r: 140, g: 70, b: 45 };
    const darkRustColor = { r: 80, g: 45, b: 30 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...metalColor };

            // Rust patches
            const rustNoise = fbm(noise, x * 0.05, y * 0.05, 4);
            if (rustNoise > 0.1) {
                const rustFactor = clamp((rustNoise - 0.1) * 2, 0, 1);
                color.r = lerp(color.r, rustColor.r, rustFactor);
                color.g = lerp(color.g, rustColor.g, rustFactor);
                color.b = lerp(color.b, rustColor.b, rustFactor);

                // Deep rust
                if (rustNoise > 0.4) {
                    const deepFactor = (rustNoise - 0.4) * 2;
                    color.r = lerp(color.r, darkRustColor.r, clamp(deepFactor, 0, 0.7));
                    color.g = lerp(color.g, darkRustColor.g, clamp(deepFactor, 0, 0.7));
                    color.b = lerp(color.b, darkRustColor.b, clamp(deepFactor, 0, 0.7));
                }
            }

            const detail = (random() - 0.5) * 10;
            data[idx] = clamp(color.r + detail, 0, 255);
            data[idx + 1] = clamp(color.g + detail, 0, 255);
            data[idx + 2] = clamp(color.b + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createMetalTechTexture() {
    const random = createSeededRandom(globalSeed + 22);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 45, g: 50, b: 60 };
    const trimColor = { r: 80, g: 180, b: 220 };
    const glowColor = { r: 100, g: 220, b: 255 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...baseColor };

            // Grid lines
            if (x % 32 < 2 || y % 32 < 2) {
                color = { ...trimColor };
            }

            // Glowing corners
            const corners = [
                [0, 0], [TEXTURE_SIZE, 0],
                [0, TEXTURE_SIZE], [TEXTURE_SIZE, TEXTURE_SIZE],
                [64, 64]
            ];

            for (const [cx, cy] of corners) {
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if (dist < 12) {
                    const glow = 1 - dist / 12;
                    color.r = lerp(color.r, glowColor.r, glow * 0.8);
                    color.g = lerp(color.g, glowColor.g, glow * 0.8);
                    color.b = lerp(color.b, glowColor.b, glow * 0.8);
                }
            }

            // Subtle circuit pattern
            if ((x + y) % 16 === 0 && random() > 0.7) {
                color.r = Math.min(color.r + 30, 255);
                color.g = Math.min(color.g + 30, 255);
                color.b = Math.min(color.b + 30, 255);
            }

            const noise = (random() - 0.5) * 5;
            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// WOOD TEXTURES
// ============================================

function createWoodTexture() {
    const random = createSeededRandom(globalSeed + 30);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const lightWood = { r: 160, g: 120, b: 80 };
    const darkWood = { r: 100, g: 70, b: 45 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            // Wood grain pattern
            const grain = Math.sin(y * 0.15 + fbm(noise, x * 0.02, y * 0.02, 3) * 8);
            const grainFactor = grain * 0.5 + 0.5;

            const color = {
                r: lerp(darkWood.r, lightWood.r, grainFactor),
                g: lerp(darkWood.g, lightWood.g, grainFactor),
                b: lerp(darkWood.b, lightWood.b, grainFactor)
            };

            const detail = (random() - 0.5) * 8;
            data[idx] = clamp(color.r + detail, 0, 255);
            data[idx + 1] = clamp(color.g + detail, 0, 255);
            data[idx + 2] = clamp(color.b + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createWoodPlanksTexture() {
    const random = createSeededRandom(globalSeed + 31);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const plankWidth = 32;
    const gapColor = { r: 30, g: 25, b: 20 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const plankIndex = Math.floor(x / plankWidth);
            const localX = x % plankWidth;

            // Gap between planks
            if (localX < 2) {
                data[idx] = gapColor.r;
                data[idx + 1] = gapColor.g;
                data[idx + 2] = gapColor.b;
                data[idx + 3] = 255;
                continue;
            }

            // Each plank has unique color
            const plankRandom = createSeededRandom(globalSeed + 31 + plankIndex * 100);
            const baseColor = {
                r: 140 + plankRandom() * 40,
                g: 100 + plankRandom() * 30,
                b: 60 + plankRandom() * 25
            };
            const darkColor = {
                r: baseColor.r * 0.6,
                g: baseColor.g * 0.6,
                b: baseColor.b * 0.6
            };

            const grain = Math.sin(y * 0.2 + plankRandom() * 10 + fbm(noise, x * 0.03, y * 0.02, 2) * 5);
            const grainFactor = grain * 0.5 + 0.5;

            const color = {
                r: lerp(darkColor.r, baseColor.r, grainFactor),
                g: lerp(darkColor.g, baseColor.g, grainFactor),
                b: lerp(darkColor.b, baseColor.b, grainFactor)
            };

            const detail = (random() - 0.5) * 10;
            data[idx] = clamp(color.r + detail, 0, 255);
            data[idx + 1] = clamp(color.g + detail, 0, 255);
            data[idx + 2] = clamp(color.b + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createWoodCrateTexture() {
    const random = createSeededRandom(globalSeed + 32);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const woodColor = { r: 150, g: 110, b: 70 };
    const darkWood = { r: 90, g: 65, b: 40 };
    const metalColor = { r: 70, g: 75, b: 80 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...woodColor };

            // Wood grain
            const grain = Math.sin(y * 0.15 + fbm(noise, x * 0.02, y * 0.015, 2) * 6);
            const grainFactor = grain * 0.3 + 0.7;
            color.r *= grainFactor;
            color.g *= grainFactor;
            color.b *= grainFactor;

            // Metal bands
            const bandPositions = [10, 118];
            for (const by of bandPositions) {
                if (y >= by && y < by + 8) {
                    color = { ...metalColor };
                    // Rivets on band
                    if ((x % 24 < 4) && (y === by + 2 || y === by + 5)) {
                        color.r += 30;
                        color.g += 30;
                        color.b += 30;
                    }
                }
            }

            // Frame
            if (x < 4 || x >= 124 || y < 4 || y >= 124) {
                color = { ...darkWood };
            }

            const detail = (random() - 0.5) * 8;
            data[idx] = clamp(color.r + detail, 0, 255);
            data[idx + 1] = clamp(color.g + detail, 0, 255);
            data[idx + 2] = clamp(color.b + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// CONCRETE TEXTURES
// ============================================

function createConcreteTexture() {
    const random = createSeededRandom(globalSeed + 40);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 140, g: 140, b: 135 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const n = fbm(noise, x * 0.03, y * 0.03, 4) * 25;
            const speckle = random() > 0.95 ? (random() - 0.5) * 40 : 0;

            data[idx] = clamp(baseColor.r + n + speckle + (random() - 0.5) * 8, 0, 255);
            data[idx + 1] = clamp(baseColor.g + n + speckle + (random() - 0.5) * 8, 0, 255);
            data[idx + 2] = clamp(baseColor.b + n + speckle + (random() - 0.5) * 8, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createConcreteCrackedTexture() {
    const random = createSeededRandom(globalSeed + 41);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const baseColor = { r: 130, g: 130, b: 125 };
    const crackColor = { r: 50, g: 50, b: 45 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...baseColor };
            const n = fbm(noise, x * 0.03, y * 0.03, 4) * 20;

            // Crack pattern using Voronoi-like approach
            const crackNoise1 = fbm(noise, x * 0.08, y * 0.08, 2);
            const crackNoise2 = fbm(noise, x * 0.08 + 50, y * 0.08 + 50, 2);

            if (Math.abs(crackNoise1 - crackNoise2) < 0.05) {
                color = { ...crackColor };
            }

            data[idx] = clamp(color.r + n + (random() - 0.5) * 10, 0, 255);
            data[idx + 1] = clamp(color.g + n + (random() - 0.5) * 10, 0, 255);
            data[idx + 2] = clamp(color.b + n + (random() - 0.5) * 10, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// TECH TEXTURES
// ============================================

function createTechTexture() {
    const random = createSeededRandom(globalSeed + 50);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const bgColor = { r: 35, g: 40, b: 55 };
    const lineColor = { r: 70, g: 200, b: 240 };
    const dimLineColor = { r: 45, g: 90, b: 110 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...bgColor };

            // Grid
            if (x % 16 === 0 || y % 16 === 0) {
                color = { ...dimLineColor };
            }

            // Border glow
            const borderDist = Math.min(x, y, TEXTURE_SIZE - 1 - x, TEXTURE_SIZE - 1 - y);
            if (borderDist < 3) {
                const glow = 1 - borderDist / 3;
                color.r = lerp(color.r, lineColor.r, glow);
                color.g = lerp(color.g, lineColor.g, glow);
                color.b = lerp(color.b, lineColor.b, glow);
            }

            // Center design
            const cx = 64, cy = 64;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            if (dist > 15 && dist < 20) {
                color = { ...lineColor };
            }
            if (dist > 25 && dist < 28) {
                color = { ...dimLineColor };
            }

            const noise = (random() - 0.5) * 4;
            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createTechScreenTexture() {
    const random = createSeededRandom(globalSeed + 51);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const bgColor = { r: 10, g: 25, b: 20 };
    const textColor = { r: 50, g: 255, b: 120 };
    const scanlineColor = { r: 5, g: 15, b: 10 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...bgColor };

            // Scanlines
            if (y % 3 === 0) {
                color = { ...scanlineColor };
            }

            // Fake text lines
            const textLines = [20, 35, 50, 65, 80, 95, 110];
            for (const ly of textLines) {
                if (y >= ly && y < ly + 6 && x > 10 && x < 118) {
                    // Random "characters"
                    const charBlock = Math.floor(x / 6);
                    const charRandom = createSeededRandom(globalSeed + ly * 100 + charBlock);
                    if (charRandom() > 0.3) {
                        const charPattern = Math.floor(charRandom() * 4);
                        const localY = y - ly;
                        const localX = x % 6;

                        if (localX < 5 && localY < 5) {
                            if ((charPattern === 0 && localY < 2) ||
                                (charPattern === 1 && localX < 2) ||
                                (charPattern === 2 && (localY === 0 || localY === 4)) ||
                                (charPattern === 3 && localY === 2)) {
                                color = { ...textColor };
                            }
                        }
                    }
                }
            }

            // Screen border
            if (x < 5 || x >= 123 || y < 5 || y >= 123) {
                color = { r: 60, g: 65, b: 70 };
            }

            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createTechWarningTexture() {
    const random = createSeededRandom(globalSeed + 52);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const yellowColor = { r: 230, g: 190, b: 50 };
    const blackColor = { r: 25, g: 25, b: 25 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            // Diagonal stripes
            const stripe = Math.floor((x + y) / 16) % 2;
            let color = stripe === 0 ? { ...yellowColor } : { ...blackColor };

            // Border
            if (x < 4 || x >= 124 || y < 4 || y >= 124) {
                color = { r: 50, g: 50, b: 50 };
            }

            const noise = (random() - 0.5) * 8;
            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// DOOR TEXTURES
// ============================================

function createDoorMetalTexture() {
    const random = createSeededRandom(globalSeed + 60);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const doorColor = { r: 80, g: 85, b: 95 };
    const frameColor = { r: 50, g: 55, b: 60 };
    const handleColor = { r: 150, g: 140, b: 100 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...doorColor };

            // Frame
            if (x < 8 || x >= 120 || y < 4 || y >= 124) {
                color = { ...frameColor };
            }

            // Handle area
            if (x >= 95 && x < 110 && y >= 55 && y < 75) {
                const hx = x - 95, hy = y - 55;
                if (hx >= 3 && hx < 12 && hy >= 5 && hy < 15) {
                    color = { ...handleColor };
                }
            }

            // Horizontal line detail
            if (y === 64 && x > 15 && x < 85) {
                color.r += 20;
                color.g += 20;
                color.b += 20;
            }

            const noise = (random() - 0.5) * 6;
            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createDoorWoodTexture() {
    const random = createSeededRandom(globalSeed + 61);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const woodColor = { r: 120, g: 80, b: 50 };
    const darkWood = { r: 70, g: 45, b: 30 };
    const handleColor = { r: 180, g: 160, b: 80 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            // Wood grain
            const grain = Math.sin(y * 0.12 + fbm(noise, x * 0.02, y * 0.015, 2) * 5);
            const grainFactor = grain * 0.3 + 0.7;

            let color = {
                r: woodColor.r * grainFactor,
                g: woodColor.g * grainFactor,
                b: woodColor.b * grainFactor
            };

            // Frame
            if (x < 10 || x >= 118 || y < 6 || y >= 122) {
                color = { ...darkWood };
            }

            // Panels
            const panels = [
                { x1: 20, y1: 15, x2: 108, y2: 55 },
                { x1: 20, y1: 65, x2: 108, y2: 115 }
            ];

            for (const p of panels) {
                if (x >= p.x1 && x < p.x2 && y >= p.y1 && y < p.y2) {
                    const edge = x === p.x1 || x === p.x2 - 1 || y === p.y1 || y === p.y2 - 1;
                    if (edge) {
                        color.r *= 0.7;
                        color.g *= 0.7;
                        color.b *= 0.7;
                    }
                }
            }

            // Handle
            if (x >= 90 && x < 105 && y >= 58 && y < 72) {
                const dist = Math.sqrt((x - 97) ** 2 + (y - 65) ** 2);
                if (dist < 5) {
                    color = { ...handleColor };
                }
            }

            const detail = (random() - 0.5) * 8;
            data[idx] = clamp(color.r + detail, 0, 255);
            data[idx + 1] = clamp(color.g + detail, 0, 255);
            data[idx + 2] = clamp(color.b + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// SPECIAL TEXTURES
// ============================================

function createLavaTexture() {
    const random = createSeededRandom(globalSeed + 70);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const hotColor = { r: 255, g: 200, b: 50 };
    const coolColor = { r: 180, g: 50, b: 20 };
    const crustColor = { r: 40, g: 20, b: 15 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const heat = fbm(noise, x * 0.04, y * 0.04, 4);
            const crust = fbm(noise, x * 0.08 + 100, y * 0.08, 3);

            let color;
            if (crust > 0.4) {
                color = { ...crustColor };
            } else {
                const heatFactor = heat * 0.5 + 0.5;
                color = {
                    r: lerp(coolColor.r, hotColor.r, heatFactor),
                    g: lerp(coolColor.g, hotColor.g, heatFactor),
                    b: lerp(coolColor.b, hotColor.b, heatFactor)
                };
            }

            data[idx] = clamp(color.r, 0, 255);
            data[idx + 1] = clamp(color.g, 0, 255);
            data[idx + 2] = clamp(color.b, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createWaterTexture() {
    const random = createSeededRandom(globalSeed + 71);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const deepColor = { r: 20, g: 50, b: 80 };
    const shallowColor = { r: 60, g: 140, b: 180 };
    const foamColor = { r: 200, g: 220, b: 240 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const wave = fbm(noise, x * 0.05, y * 0.05, 3);
            const waveFactor = wave * 0.5 + 0.5;

            let color = {
                r: lerp(deepColor.r, shallowColor.r, waveFactor),
                g: lerp(deepColor.g, shallowColor.g, waveFactor),
                b: lerp(deepColor.b, shallowColor.b, waveFactor)
            };

            // Foam highlights
            if (wave > 0.35) {
                const foamFactor = (wave - 0.35) * 3;
                color.r = lerp(color.r, foamColor.r, clamp(foamFactor, 0, 0.4));
                color.g = lerp(color.g, foamColor.g, clamp(foamFactor, 0, 0.4));
                color.b = lerp(color.b, foamColor.b, clamp(foamFactor, 0, 0.4));
            }

            data[idx] = clamp(color.r, 0, 255);
            data[idx + 1] = clamp(color.g, 0, 255);
            data[idx + 2] = clamp(color.b, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createFleshTexture() {
    const random = createSeededRandom(globalSeed + 72);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const fleshColor = { r: 140, g: 70, b: 70 };
    const veinColor = { r: 80, g: 30, b: 40 };
    const highlightColor = { r: 180, g: 100, b: 90 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const base = fbm(noise, x * 0.03, y * 0.03, 4);
            let color = { ...fleshColor };

            // Veins
            const vein1 = fbm(noise, x * 0.06, y * 0.06, 2);
            const vein2 = fbm(noise, x * 0.06 + 50, y * 0.06 + 50, 2);
            if (Math.abs(vein1 - vein2) < 0.03) {
                color = { ...veinColor };
            }

            // Texture variation
            color.r += base * 30;
            color.g += base * 15;
            color.b += base * 15;

            // Wet highlights
            if (base > 0.3) {
                const highlightFactor = (base - 0.3) * 1.5;
                color.r = lerp(color.r, highlightColor.r, clamp(highlightFactor, 0, 0.3));
                color.g = lerp(color.g, highlightColor.g, clamp(highlightFactor, 0, 0.3));
                color.b = lerp(color.b, highlightColor.b, clamp(highlightFactor, 0, 0.3));
            }

            data[idx] = clamp(color.r, 0, 255);
            data[idx + 1] = clamp(color.g, 0, 255);
            data[idx + 2] = clamp(color.b, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// FLOOR TEXTURES
// ============================================

function createFloorTileTexture() {
    const random = createSeededRandom(globalSeed + 80);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const tileColor = { r: 180, g: 175, b: 165 };
    const groutColor = { r: 100, g: 95, b: 90 };
    const tileSize = 32;

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const localX = x % tileSize;
            const localY = y % tileSize;

            let color;
            if (localX < 2 || localY < 2) {
                color = { ...groutColor };
            } else {
                const tileId = Math.floor(y / tileSize) * 4 + Math.floor(x / tileSize);
                const tileRandom = createSeededRandom(globalSeed + 80 + tileId * 10);
                const variation = (tileRandom() - 0.5) * 20;

                color = {
                    r: tileColor.r + variation,
                    g: tileColor.g + variation,
                    b: tileColor.b + variation
                };
            }

            const noise = (random() - 0.5) * 6;
            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createFloorStoneTexture() {
    const random = createSeededRandom(globalSeed + 81);
    const noise = createNoise2D(random);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const stoneColor = { r: 100, g: 95, b: 90 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            const n = fbm(noise, x * 0.04, y * 0.04, 4) * 30;
            const detail = (random() - 0.5) * 10;

            data[idx] = clamp(stoneColor.r + n + detail, 0, 255);
            data[idx + 1] = clamp(stoneColor.g + n + detail, 0, 255);
            data[idx + 2] = clamp(stoneColor.b + n + detail, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

function createFloorMetalTexture() {
    const random = createSeededRandom(globalSeed + 82);
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    const metalColor = { r: 75, g: 80, b: 85 };
    const grooveColor = { r: 55, g: 60, b: 65 };

    for (let y = 0; y < TEXTURE_SIZE; y++) {
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            const idx = (y * TEXTURE_SIZE + x) * 4;

            let color = { ...metalColor };

            // Diamond plate pattern
            const px = x % 16;
            const py = y % 16;
            const offset = (Math.floor(y / 16) % 2) * 8;
            const ax = (x + offset) % 16;

            // Diamond shape
            if (Math.abs(ax - 8) + Math.abs(py - 8) < 6) {
                color.r += 15;
                color.g += 15;
                color.b += 15;
            }

            // Grooves
            if (x % 32 < 2 || y % 32 < 2) {
                color = { ...grooveColor };
            }

            const noise = (random() - 0.5) * 5;
            data[idx] = clamp(color.r + noise, 0, 255);
            data[idx + 1] = clamp(color.g + noise, 0, 255);
            data[idx + 2] = clamp(color.b + noise, 0, 255);
            data[idx + 3] = 255;
        }
    }

    return createImageFromData(data);
}

// ============================================
// HELPERS
// ============================================

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
