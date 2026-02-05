# Bang-Bang: Kapsamlı Geliştirme Planı

## Code Review Özeti

### Mevcut Durum Analizi

**Güçlü Yönler:**
- Temiz modüler mimari (27 JS modülü)
- Sıfır bağımlılık (pure vanilla JS)
- Optimize edilmiş ImageData batch rendering
- Prosedürel texture/ses üretimi
- Frame-bağımsız fizik (delta time)
- DDA raycasting implementasyonu

**Zayıf Yönler:**
- Texture'lar her yüklemede yeniden üretiliyor (tutarsızlık)
- Düşman AI basit (direct beeline, pathfinding yok)
- Sprite'larda alpha blending yok
- Çözünürlük sabit (640x400)
- Partikül sistemi yok
- Lighting sistemi yok

---

## 1. GRAFİK GELİŞTİRMELERİ

### 1.1 Texture Sistemi Yenileme

**Öncelik: YÜKSEK**

#### Sorun:
- Texture'lar her sayfa yüklemesinde random noise ile üretiliyor
- 64x64 düşük çözünürlük
- Sadece 4 texture tipi var

#### Çözüm:

```javascript
// src/engine/textures.js - Yeni sistem

// Seeded random ile tutarlı texture'lar
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

export const TEXTURE_SIZE = 128; // 64 → 128 (2x detail)

// Yeni texture tipleri
const TEXTURE_TYPES = [
    'brick', 'brick_mossy', 'brick_damaged',
    'stone', 'stone_carved', 'stone_ancient',
    'metal', 'metal_rusted', 'metal_tech',
    'wood', 'wood_planks', 'wood_crate',
    'concrete', 'concrete_cracked',
    'tile', 'tile_bathroom',
    'door_metal', 'door_wood',
    'switch_on', 'switch_off'
];

// Normal mapping için texture çiftleri
export function generateNormalMap(diffuseData) {
    // Sobel filter ile height → normal dönüşümü
    // Işık hesaplamaları için
}
```

#### Yeni Texture Özellikleri:
- [ ] 128x128 çözünürlük
- [ ] Seeded random (tutarlılık)
- [ ] Normal map desteği
- [ ] 20+ farklı texture tipi
- [ ] Animasyonlu texture'lar (su, lav, ekranlar)

---

### 1.2 Dinamik Işık Sistemi

**Öncelik: YÜKSEK**

#### Mevcut:
- Sadece mesafe bazlı fog
- Statik ambient light

#### Hedef Sistem:

```javascript
// src/engine/lighting.js

export const LIGHT_TYPES = {
    POINT: 'point',      // Lambalar, meşaleler
    SPOT: 'spot',        // El feneri
    AREA: 'area',        // Pencereler
    MUZZLE: 'muzzle'     // Silah ateşi (anlık)
};

export class Light {
    constructor(type, x, y, radius, color, intensity) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.intensity = intensity;
        this.flicker = 0; // Meşale efekti için
    }
}

export class LightingSystem {
    constructor() {
        this.lights = [];
        this.ambientLight = 0.15;
        this.lightMap = null; // Pre-calculated per frame
    }

    calculateLightAtPoint(x, y) {
        let totalLight = this.ambientLight;

        for (const light of this.lights) {
            const dist = Math.hypot(x - light.x, y - light.y);
            if (dist < light.radius) {
                const falloff = 1 - (dist / light.radius);
                totalLight += falloff * falloff * light.intensity;
            }
        }

        return Math.min(1, totalLight);
    }
}
```

#### Işık Özellikleri:
- [ ] Point light (lambalar)
- [ ] Muzzle flash dinamik ışık
- [ ] Flicker efekti (meşaleler)
- [ ] Renkli ışıklar
- [ ] Gölge casting (ray marching)
- [ ] El feneri (player spotlight)

---

### 1.3 Partikül Sistemi

**Öncelik: ORTA**

```javascript
// src/engine/particles.js

export class ParticleSystem {
    constructor(maxParticles = 1000) {
        // Object pooling ile allocation önleme
        this.pool = new Array(maxParticles);
        this.activeCount = 0;
    }

    emit(type, x, y, config) {
        // Particle tipleri:
        // - blood: Kırmızı damlalar, yerçekimi
        // - spark: Sarı/turuncu, hızlı fade
        // - smoke: Gri, yavaş yükselir
        // - debris: Duvar parçaları
        // - shell: Kovan düşmesi
        // - muzzle: Ateş efekti
    }

    update(dt) {
        for (let i = 0; i < this.activeCount; i++) {
            const p = this.pool[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.life -= dt;
            p.alpha = p.life / p.maxLife;

            if (p.life <= 0) this.recycle(i);
        }
    }
}
```

#### Partikül Tipleri:
- [ ] Kan sıçraması (düşman vurulunca)
- [ ] Kıvılcımlar (metal duvara mermi)
- [ ] Duman (patlama sonrası)
- [ ] Toz (hareket ederken)
- [ ] Kovan düşmesi (fizikli)
- [ ] Muzzle flash partikül

---

### 1.4 Post-Processing Efektleri

**Öncelik: ORTA**

```javascript
// src/engine/postProcess.js

export class PostProcessor {
    constructor(ctx) {
        this.effects = [];
        this.enabled = true;
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    process(imageData) {
        for (const effect of this.effects) {
            effect.apply(imageData);
        }
    }
}

// Efekt tipleri
export const EFFECTS = {
    // CRT scanlines + curvature
    CRT: {
        scanlineIntensity: 0.1,
        curvature: 0.02,
        vignette: 0.3
    },

    // Bloom (parlak alanları glow yap)
    BLOOM: {
        threshold: 0.8,
        intensity: 0.3,
        radius: 4
    },

    // Chromatic aberration (kenar renk kayması)
    ABERRATION: {
        intensity: 2 // pixel offset
    },

    // Film grain
    GRAIN: {
        intensity: 0.05
    },

    // Damage vignette
    DAMAGE: {
        intensity: 0, // 0-1, hasar aldıkça artar
        color: [255, 0, 0]
    }
};
```

#### Post-Process Efektleri:
- [ ] CRT shader (scanlines, barrel distortion)
- [ ] Bloom (parlak alanlar glow)
- [ ] Vignette (köşe karartma)
- [ ] Chromatic aberration
- [ ] Film grain (opsiyonel)
- [ ] Motion blur (opsiyonel, performans)
- [ ] Damage screen effect (kırmızı pulse)

---

### 1.5 Sprite Sistemi İyileştirmesi

**Öncelik: YÜKSEK**

```javascript
// src/engine/spriteRenderer.js - Geliştirilmiş

// 8-yönlü sprite desteği
const SPRITE_DIRECTIONS = 8; // 0, 45, 90, 135, 180, 225, 270, 315

// Animasyon sistemi
export class SpriteAnimation {
    constructor(frames, fps = 10) {
        this.frames = frames;
        this.fps = fps;
        this.currentFrame = 0;
        this.elapsed = 0;
    }

    update(dt) {
        this.elapsed += dt;
        if (this.elapsed >= 1 / this.fps) {
            this.elapsed = 0;
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }
    }
}

// Alpha blending desteği
function blendPixel(src, dst, alpha) {
    return {
        r: src.r * alpha + dst.r * (1 - alpha),
        g: src.g * alpha + dst.g * (1 - alpha),
        b: src.b * alpha + dst.b * (1 - alpha)
    };
}
```

#### Sprite İyileştirmeleri:
- [ ] Alpha blending (yumuşak kenarlar)
- [ ] 8-yönlü düşman sprite'ları
- [ ] Animasyon frame sistemi
- [ ] Sprite sheet desteği (harici asset yüklenebilir)
- [ ] Billboard rotation düzeltmesi
- [ ] Daha detaylı düşman tasarımları

---

### 1.6 Zemin/Tavan Texture Mapping

**Öncelik: ORTA**

```javascript
// Raycasting tabanlı zemin texture'ı
function renderTexturedFloor(rays, playerX, playerY, playerAngle) {
    for (let y = horizonY; y < SCREEN.HEIGHT; y++) {
        // Her satır için mesafe hesapla
        const rowDistance = (SCREEN.HEIGHT / 2) / (y - horizonY);

        for (let x = 0; x < SCREEN.WIDTH; x++) {
            const rayAngle = playerAngle - FOV/2 + (x / SCREEN.WIDTH) * FOV;

            // Dünya koordinatları
            const floorX = playerX + rowDistance * Math.cos(rayAngle);
            const floorY = playerY + rowDistance * Math.sin(rayAngle);

            // Texture koordinatları
            const texX = Math.floor(floorX * TEXTURE_SIZE) % TEXTURE_SIZE;
            const texY = Math.floor(floorY * TEXTURE_SIZE) % TEXTURE_SIZE;

            // Texture'dan renk al + mesafe karartması
        }
    }
}
```

#### Zemin/Tavan:
- [ ] Texture mapped zemin
- [ ] Texture mapped tavan
- [ ] Farklı oda tipleri için farklı texture
- [ ] Su/lav zemin (animasyonlu)
- [ ] Skybox (dış mekan için)

---

## 2. OYNANŞ GELİŞTİRMELERİ

### 2.1 Hareket Sistemi

**Öncelik: YÜKSEK**

```javascript
// src/player/movement.js - Geliştirilmiş

export const MOVEMENT = {
    WALK_SPEED: 3.0,
    RUN_SPEED: 5.5,
    CROUCH_SPEED: 1.5,

    // Yeni mekanikler
    ACCELERATION: 15.0,    // Anlık değil, ivmeli hareket
    DECELERATION: 12.0,
    AIR_CONTROL: 0.3,      // Havadayken hareket

    // Head bob
    BOB_FREQUENCY: 8,
    BOB_AMPLITUDE: 4,      // pixel

    // View kick
    LAND_KICK: 0.1,        // Yere inince ekran sarsıntısı
    DAMAGE_KICK: 0.2,      // Hasar alınca
};

export class MovementController {
    constructor(player) {
        this.velocity = { x: 0, y: 0 };
        this.isGrounded = true;
        this.isCrouching = false;
        this.isRunning = false;
        this.bobPhase = 0;
    }

    update(input, dt) {
        // İvmeli hareket (daha iyi his)
        const targetVel = this.calculateTargetVelocity(input);

        this.velocity.x = lerp(
            this.velocity.x,
            targetVel.x,
            MOVEMENT.ACCELERATION * dt
        );
        this.velocity.y = lerp(
            this.velocity.y,
            targetVel.y,
            MOVEMENT.ACCELERATION * dt
        );

        // Head bob
        if (this.isMoving()) {
            this.bobPhase += MOVEMENT.BOB_FREQUENCY * dt;
        }
    }

    getHeadBob() {
        return Math.sin(this.bobPhase) * MOVEMENT.BOB_AMPLITUDE;
    }
}
```

#### Hareket Özellikleri:
- [ ] İvmeli hareket (acceleration/deceleration)
- [ ] Koşma (Shift)
- [ ] Eğilme (Ctrl) - daha yavaş, düşük profil
- [ ] Head bob (yürürken ekran sallanması)
- [ ] Landing impact (zıplamadan sonra)
- [ ] Slide mekanik (koşarken eğilme)

---

### 2.2 Silah Sistemi Genişletme

**Öncelik: YÜKSEK**

```javascript
// src/player/weapons.js - Genişletilmiş

export const WEAPONS = {
    // Mevcut
    PISTOL: {
        name: 'Pistol',
        damage: 25,
        fireRate: 0.4,
        ammoMax: Infinity,
        spread: 0,
        pellets: 1,
        recoil: 0.02,
        type: 'hitscan'
    },

    SHOTGUN: {
        name: 'Shotgun',
        damage: 15,
        fireRate: 0.8,
        ammoMax: 50,
        spread: 0.15,
        pellets: 8,
        recoil: 0.08,
        type: 'hitscan'
    },

    // Yeni silahlar
    SMG: {
        name: 'SMG',
        damage: 12,
        fireRate: 0.08,
        ammoMax: 200,
        spread: 0.04,
        pellets: 1,
        recoil: 0.015,
        type: 'hitscan'
    },

    ROCKET_LAUNCHER: {
        name: 'Rocket Launcher',
        damage: 100,
        fireRate: 1.2,
        ammoMax: 20,
        projectileSpeed: 8,
        splashRadius: 3,
        recoil: 0.1,
        type: 'projectile'
    },

    PLASMA_RIFLE: {
        name: 'Plasma Rifle',
        damage: 35,
        fireRate: 0.2,
        ammoMax: 150,
        projectileSpeed: 15,
        recoil: 0.03,
        type: 'projectile'
    },

    RAILGUN: {
        name: 'Railgun',
        damage: 150,
        fireRate: 2.0,
        ammoMax: 10,
        penetration: 3, // Kaç düşmandan geçer
        recoil: 0.15,
        type: 'hitscan'
    },

    CHAINSAW: {
        name: 'Chainsaw',
        damage: 20, // per tick
        fireRate: 0.1,
        ammoMax: 100, // fuel
        range: 1.5,
        type: 'melee'
    }
};

// Projectile sistemi
export class Projectile {
    constructor(weapon, x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = weapon.projectileSpeed;
        this.damage = weapon.damage;
        this.splashRadius = weapon.splashRadius || 0;
        this.alive = true;
    }

    update(dt, map, enemies) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;

        // Duvar çarpışması
        if (map.isWall(Math.floor(this.x), Math.floor(this.y))) {
            this.explode(enemies);
        }

        // Düşman çarpışması
        for (const enemy of enemies) {
            if (this.hits(enemy)) {
                this.explode(enemies);
            }
        }
    }

    explode(enemies) {
        if (this.splashRadius > 0) {
            // Alan hasarı
            for (const enemy of enemies) {
                const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist < this.splashRadius) {
                    const falloff = 1 - (dist / this.splashRadius);
                    enemy.takeDamage(this.damage * falloff);
                }
            }
        }
        this.alive = false;
        // Partikül efekti tetikle
    }
}
```

#### Silah Özellikleri:
- [ ] 7+ silah tipi
- [ ] Projectile sistemi (roket, plazma)
- [ ] Splash damage
- [ ] Silah penetration (railgun)
- [ ] Melee silahlar
- [ ] Alternatif ateş modları
- [ ] Silah upgrade sistemi
- [ ] Recoil pattern (her silaha özgü)

---

### 2.3 Düşman AI Geliştirme

**Öncelik: YÜKSEK**

```javascript
// src/enemies/ai.js - Geliştirilmiş

// A* Pathfinding
export class Pathfinder {
    constructor(map) {
        this.map = map;
        this.navMesh = this.buildNavMesh();
    }

    buildNavMesh() {
        // Map'ten yürünebilir alanları çıkar
        // Node'ları oluştur
    }

    findPath(startX, startY, endX, endY) {
        // A* implementasyonu
        const openSet = new PriorityQueue();
        const closedSet = new Set();
        // ...
    }
}

// Behavior Tree sistemi
export class BehaviorTree {
    constructor(root) {
        this.root = root;
    }

    update(entity, context) {
        return this.root.execute(entity, context);
    }
}

// Düşman davranış tipleri
export const BEHAVIORS = {
    PATROL: {
        // Belirli noktalar arası dolaş
        // Rastgele dur, etrafına bak
    },

    INVESTIGATE: {
        // Son görülen pozisyona git
        // Ses kaynağına git
    },

    FLANK: {
        // Oyuncunun yanından veya arkasından yaklaş
    },

    TAKE_COVER: {
        // En yakın cover noktasına koş
        // Arada ara sıra ateş et
    },

    RETREAT: {
        // Can düşükse geri çekil
        // Sağlık paketi ara
    },

    SWARM: {
        // Diğer düşmanlarla koordineli hareket
    }
};

// Düşman algılama sistemi
export class PerceptionSystem {
    constructor(enemy) {
        this.viewAngle = Math.PI / 2;  // 90 derece görüş açısı
        this.viewRange = 15;
        this.hearingRange = 8;
        this.lastKnownPlayerPos = null;
        this.alertLevel = 0; // 0-100
    }

    canSeePlayer(player, map) {
        // Mesafe kontrolü
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist > this.viewRange) return false;

        // Açı kontrolü
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        const angleDiff = normalizeAngle(angleToPlayer - this.facing);
        if (Math.abs(angleDiff) > this.viewAngle / 2) return false;

        // Line of sight kontrolü
        return !this.raycastToPlayer(player, map);
    }

    hearSound(soundX, soundY, loudness) {
        const dist = Math.hypot(soundX - this.x, soundY - this.y);
        if (dist < this.hearingRange * loudness) {
            this.alertLevel += 20;
            this.lastKnownPlayerPos = { x: soundX, y: soundY };
        }
    }
}
```

#### AI Özellikleri:
- [ ] A* pathfinding
- [ ] Behavior tree sistemi
- [ ] Patrol rotaları
- [ ] Ses algılama
- [ ] Cover sistemi
- [ ] Flanking davranışı
- [ ] Grup koordinasyonu
- [ ] Alert level sistemi (idle → suspicious → alert → combat)

---

### 2.4 Yeni Düşman Tipleri

**Öncelik: ORTA**

```javascript
// src/enemies/types.js

export const ENEMY_TYPES = {
    // Mevcut
    GRUNT: { /* ... */ },
    SHOOTER: { /* ... */ },
    CHARGER: { /* ... */ },

    // Yeni tipler
    SNIPER: {
        health: 40,
        speed: 0.5,
        damage: 50,
        range: 25,
        behavior: 'sniper',
        sprite: 'sniper',
        // Uzakta durur, lazer sight gösterir
    },

    TANK: {
        health: 300,
        speed: 1.0,
        damage: 40,
        range: 2,
        behavior: 'tank',
        armor: 0.5, // %50 hasar azaltma
        // Yavaş ama dayanıklı
    },

    NINJA: {
        health: 60,
        speed: 4.0,
        damage: 30,
        range: 1.5,
        behavior: 'assassin',
        // Hızlı, görünmez olabilir
        cloakDuration: 3,
        cloakCooldown: 10
    },

    BOMBER: {
        health: 50,
        speed: 2.5,
        damage: 100,
        range: 2,
        behavior: 'suicide',
        // Yaklaşıp patlar
        explodeRadius: 3
    },

    TURRET: {
        health: 100,
        speed: 0,
        damage: 10,
        range: 15,
        fireRate: 0.1,
        behavior: 'stationary',
        // Sabit, hızlı ateş
    },

    BOSS_DEMON: {
        health: 1000,
        speed: 2.0,
        damage: 50,
        range: 3,
        behavior: 'boss',
        phases: 3,
        // Farklı fazlarda farklı saldırılar
    }
};
```

---

### 2.5 Level Progression Sistemi

**Öncelik: ORTA**

```javascript
// src/world/progression.js

export class ProgressionSystem {
    constructor() {
        this.currentLevel = 1;
        this.currentFloor = 1;
        this.difficulty = 1.0;

        // Tema progresyonu
        this.themes = [
            'dungeon',      // Floors 1-5
            'techbase',     // Floors 6-10
            'hellscape',    // Floors 11-15
            'void'          // Floors 16+
        ];
    }

    getCurrentTheme() {
        const themeIndex = Math.floor((this.currentFloor - 1) / 5);
        return this.themes[Math.min(themeIndex, this.themes.length - 1)];
    }

    getEnemySpawnConfig() {
        // Floor'a göre düşman çeşitliliği
        const config = {
            types: ['grunt'],
            count: 3 + this.currentFloor,
            eliteChance: 0.05 * this.currentFloor
        };

        if (this.currentFloor >= 3) config.types.push('shooter');
        if (this.currentFloor >= 5) config.types.push('charger');
        if (this.currentFloor >= 7) config.types.push('sniper');
        if (this.currentFloor >= 10) config.types.push('tank');
        if (this.currentFloor % 5 === 0) config.boss = true;

        return config;
    }

    getLootTable() {
        // Floor'a göre loot kalitesi
        return {
            healthChance: 0.3,
            ammoChance: 0.4,
            weaponChance: 0.1 + (this.currentFloor * 0.02),
            perkChance: 0.05 + (this.currentFloor * 0.01)
        };
    }
}
```

---

### 2.6 Perk/Upgrade Sistemi

**Öncelik: ORTA**

```javascript
// src/player/perks.js

export const PERKS = {
    // Savaş perkleri
    DOUBLE_DAMAGE: {
        name: 'Double Damage',
        description: '2x silah hasarı',
        duration: 30, // saniye
        rarity: 'rare',
        effect: (player) => { player.damageMultiplier = 2; }
    },

    RAPID_FIRE: {
        name: 'Rapid Fire',
        description: '%50 daha hızlı ateş',
        duration: 20,
        rarity: 'uncommon',
        effect: (player) => { player.fireRateMultiplier = 1.5; }
    },

    VAMPIRE: {
        name: 'Vampire',
        description: 'Öldürünce %10 can kazan',
        duration: 45,
        rarity: 'rare',
        effect: (player) => { player.vampiric = 0.1; }
    },

    // Savunma perkleri
    SHIELD: {
        name: 'Shield',
        description: '50 geçici zırh',
        duration: 60,
        rarity: 'uncommon',
        stackable: true
    },

    REGENERATION: {
        name: 'Regeneration',
        description: 'Saniyede 2 can yenile',
        duration: 30,
        rarity: 'uncommon'
    },

    // Hareket perkleri
    SPEED_BOOST: {
        name: 'Speed Boost',
        description: '%30 hız artışı',
        duration: 20,
        rarity: 'common'
    },

    // Özel perkler
    EXPLOSIVE_ROUNDS: {
        name: 'Explosive Rounds',
        description: 'Mermiler patlayıcı',
        duration: 15,
        rarity: 'legendary',
        effect: (player) => { player.explosiveRounds = true; }
    }
};

// Kalıcı upgrade sistemi (meta progression)
export const PERMANENT_UPGRADES = {
    MAX_HEALTH: {
        name: 'Max Health',
        levels: 10,
        costPerLevel: [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200],
        effect: (level) => 100 + level * 10 // 100 → 200
    },

    STARTING_WEAPON: {
        name: 'Starting Weapon',
        levels: 3,
        costPerLevel: [500, 2000, 10000],
        effect: (level) => ['pistol', 'smg', 'shotgun', 'plasma'][level]
    },

    LUCK: {
        name: 'Luck',
        levels: 5,
        costPerLevel: [200, 500, 1000, 2500, 5000],
        effect: (level) => 1 + level * 0.1 // Loot drop artışı
    }
};
```

---

## 3. TEKNİK İYİLEŞTİRMELER

### 3.1 Performans Optimizasyonları

**Öncelik: YÜKSEK**

```javascript
// Web Worker ile raycasting
// src/engine/raycastWorker.js
self.onmessage = function(e) {
    const { playerX, playerY, playerAngle, map, fov, rayCount } = e.data;
    const rays = castAllRays(playerX, playerY, playerAngle, map, fov, rayCount);
    self.postMessage(rays);
};

// Object pooling
export class ObjectPool {
    constructor(factory, initialSize = 100) {
        this.factory = factory;
        this.pool = [];
        this.activeObjects = [];

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }
    }

    acquire() {
        const obj = this.pool.pop() || this.factory();
        this.activeObjects.push(obj);
        return obj;
    }

    release(obj) {
        const idx = this.activeObjects.indexOf(obj);
        if (idx !== -1) {
            this.activeObjects.splice(idx, 1);
            obj.reset();
            this.pool.push(obj);
        }
    }
}

// Spatial partitioning
export class SpatialHash {
    constructor(cellSize = 4) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    getKey(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    insert(entity) {
        const key = this.getKey(entity.x, entity.y);
        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }
        this.cells.get(key).push(entity);
    }

    query(x, y, radius) {
        // Sadece yakın hücreleri kontrol et
        const results = [];
        const cellRadius = Math.ceil(radius / this.cellSize);

        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                const key = this.getKey(x + dx * this.cellSize, y + dy * this.cellSize);
                const cell = this.cells.get(key);
                if (cell) results.push(...cell);
            }
        }

        return results;
    }
}
```

#### Optimizasyonlar:
- [ ] Web Worker ile paralel raycasting
- [ ] Object pooling (partikül, mermi)
- [ ] Spatial hashing (düşman collision)
- [ ] Frustum culling (görünmeyen sprite'ları render etme)
- [ ] LOD sistemi (uzaktaki sprite'lar daha basit)
- [ ] Texture atlas (tek draw call)
- [ ] Dirty rectangle rendering

---

### 3.2 Ses Sistemi Geliştirme

**Öncelik: ORTA**

```javascript
// src/core/audioSystem.js

export class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        // Kategori bazlı volume
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.ambientGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.ambientGain.connect(this.masterGain);

        // 3D audio için panner pool
        this.panners = [];
    }

    // 3D positional audio
    playAt(soundName, x, y, volume = 1) {
        const panner = this.ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 20;
        panner.rolloffFactor = 1;

        // Oyuncu pozisyonuna göre panner ayarla
        panner.setPosition(x - playerX, 0, y - playerY);

        panner.connect(this.sfxGain);
        // Ses çal...
    }

    // Ambient soundscape
    playAmbient(soundName, loop = true) {
        // Arka plan atmosfer sesleri
    }

    // Dinamik müzik
    setMusicIntensity(level) {
        // 0: Exploration (sakin)
        // 1: Combat (intense)
        // 2: Boss (epic)
    }
}
```

#### Ses Özellikleri:
- [ ] 3D positional audio
- [ ] Ses kategorileri (SFX, Müzik, Ambient)
- [ ] Volume kontrolleri
- [ ] Dinamik müzik (combat intensity)
- [ ] Ambient soundscape
- [ ] Reverb (oda boyutuna göre)
- [ ] Ses öncelik sistemi (çok fazla ses olunca)

---

### 3.3 Çözünürlük ve Ölçekleme

**Öncelik: ORTA**

```javascript
// src/core/display.js

export const QUALITY_PRESETS = {
    LOW: {
        renderScale: 0.5,    // 320x200
        textureSize: 32,
        maxParticles: 200,
        postProcess: false,
        shadowQuality: 0
    },
    MEDIUM: {
        renderScale: 0.75,   // 480x300
        textureSize: 64,
        maxParticles: 500,
        postProcess: true,
        shadowQuality: 1
    },
    HIGH: {
        renderScale: 1.0,    // 640x400
        textureSize: 128,
        maxParticles: 1000,
        postProcess: true,
        shadowQuality: 2
    },
    ULTRA: {
        renderScale: 1.5,    // 960x600
        textureSize: 256,
        maxParticles: 2000,
        postProcess: true,
        shadowQuality: 3
    }
};

// Dinamik kalite ayarı (FPS'e göre)
export class DynamicQuality {
    constructor() {
        this.targetFPS = 60;
        this.currentPreset = 'MEDIUM';
        this.fpsHistory = [];
    }

    update(currentFPS) {
        this.fpsHistory.push(currentFPS);
        if (this.fpsHistory.length > 60) {
            this.fpsHistory.shift();
        }

        const avgFPS = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;

        if (avgFPS < 45 && this.currentPreset !== 'LOW') {
            this.lowerQuality();
        } else if (avgFPS > 55 && this.currentPreset !== 'ULTRA') {
            this.raiseQuality();
        }
    }
}
```

---

## 4. YENİ ÖZELLİKLER

### 4.1 Harita Editörü

```javascript
// src/editor/mapEditor.js

export class MapEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.currentTool = 'wall';
        this.selectedTexture = 1;
        this.map = new Map2D(32, 32);

        this.tools = {
            wall: new WallTool(),
            floor: new FloorTool(),
            spawn: new SpawnTool(),
            enemy: new EnemyTool(),
            loot: new LootTool(),
            light: new LightTool(),
            trigger: new TriggerTool()
        };
    }

    export() {
        return JSON.stringify(this.map.serialize());
    }

    import(json) {
        this.map.deserialize(JSON.parse(json));
    }
}
```

### 4.2 Replay Sistemi

```javascript
// src/systems/replay.js

export class ReplaySystem {
    constructor() {
        this.recording = false;
        this.frames = [];
        this.currentFrame = 0;
    }

    record(gameState) {
        if (!this.recording) return;

        this.frames.push({
            timestamp: performance.now(),
            player: { ...gameState.player },
            enemies: gameState.enemies.map(e => ({ ...e })),
            projectiles: [...gameState.projectiles]
        });
    }

    playback(frameIndex) {
        // Frame'i reconstruct et
    }

    exportToFile() {
        // JSON veya binary format
    }
}
```

### 4.3 Achievements Sistemi

```javascript
// src/systems/achievements.js

export const ACHIEVEMENTS = {
    FIRST_BLOOD: {
        name: 'First Blood',
        description: 'İlk düşmanı öldür',
        icon: '🩸',
        check: (stats) => stats.totalKills >= 1
    },

    MASSACRE: {
        name: 'Massacre',
        description: 'Tek run\'da 100 düşman öldür',
        icon: '💀',
        check: (stats) => stats.runKills >= 100
    },

    SPEEDRUNNER: {
        name: 'Speedrunner',
        description: 'İlk 10 floor\'u 10 dakikada geç',
        icon: '⚡',
        check: (stats) => stats.floor >= 10 && stats.runTime <= 600
    },

    PACIFIST: {
        name: 'Pacifist',
        description: 'Hiç düşman öldürmeden 1 floor geç',
        icon: '🕊️',
        hidden: true,
        check: (stats) => stats.floorKills === 0 && stats.floorComplete
    }
};
```

---

## 5. UYGULAMA YOL HARİTASI

### Faz 1: Temel Grafik İyileştirmeleri (2-3 hafta)
1. ✅ Texture sistemi yenileme (seeded, 128x128)
2. ✅ Partikül sistemi
3. ✅ Temel ışık sistemi (point light)
4. ✅ Post-process: CRT + Vignette

### Faz 2: Oynanış Temeli (2-3 hafta)
1. ✅ İvmeli hareket + head bob
2. ✅ Yeni silahlar (5 adet)
3. ✅ Projectile sistemi
4. ✅ Temel perk sistemi

### Faz 3: Düşman AI (2 hafta)
1. ✅ A* pathfinding
2. ✅ Behavior tree
3. ✅ 3 yeni düşman tipi
4. ✅ Boss sistemi temeli

### Faz 4: Polish (1-2 hafta)
1. ✅ Ses sistemi iyileştirme
2. ✅ UI/UX geliştirme
3. ✅ Performans optimizasyonu
4. ✅ Bug fix ve dengeleme

### Faz 5: Ekstra Özellikler (Ongoing)
1. Multiplayer iyileştirme
2. Harita editörü
3. Achievement sistemi
4. Leaderboard genişletme

---

## 6. KOD STANDARTLARI (Güncellenmiş)

### Yeni Modül Yapısı
```
/src
├── core/              # Değişmez
├── engine/
│   ├── raycaster.js
│   ├── renderer.js
│   ├── textures.js
│   ├── spriteRenderer.js
│   ├── lighting.js      # YENİ
│   ├── particles.js     # YENİ
│   └── postProcess.js   # YENİ
├── input/             # Değişmez
├── player/
│   ├── player.js
│   ├── movement.js      # YENİ (ayrıştırılmış)
│   ├── weapon.js
│   ├── projectiles.js   # YENİ
│   └── perks.js         # YENİ
├── enemies/
│   ├── enemy.js
│   ├── types.js         # YENİ
│   ├── ai/
│   │   ├── pathfinder.js  # YENİ
│   │   ├── behaviors.js   # YENİ
│   │   └── perception.js  # YENİ
│   └── boss.js          # YENİ
├── world/
│   ├── map.js
│   ├── mapGenerator.js
│   ├── loot.js
│   ├── progression.js   # YENİ
│   └── themes/          # YENİ
│       ├── dungeon.js
│       ├── techbase.js
│       └── hellscape.js
├── ui/                # Değişmez
├── systems/           # YENİ
│   ├── achievements.js
│   ├── replay.js
│   └── settings.js
└── editor/            # YENİ
    └── mapEditor.js
```

### Performance Budget
- Frame time: < 16.67ms (60 FPS)
- Memory: < 100MB
- Particles: Max 1000 active
- Enemies: Max 50 active
- Projectiles: Max 100 active

---

## Sonuç

Bu plan, Bang-Bang'i modern bir retro FPS deneyimine dönüştürmek için gereken tüm adımları kapsar. Öncelik sırası:

1. **Grafik** → Oyuncunun ilk izlenimi
2. **Oynanış** → Oyuncunun kalması
3. **İçerik** → Oyuncunun tekrar oynaması
4. **Polish** → Oyuncunun tavsiye etmesi

Her faz tamamlandığında oyun oynanabilir kalmalı. Küçük adımlar, sık commit.

**Hadi başlayalım!** 🎮
