// Object Pool - bellek optimizasyonu
// Partikül, mermi gibi sık oluşturulan/silinen objeler için

/**
 * Generic Object Pool
 */
export class ObjectPool {
    /**
     * @param {Function} factory - Yeni obje oluşturan fonksiyon
     * @param {Function} reset - Objeyi sıfırlayan fonksiyon
     * @param {number} initialSize - Başlangıç havuz boyutu
     */
    constructor(factory, reset = null, initialSize = 100) {
        this.factory = factory;
        this.resetFn = reset || ((obj) => obj);
        this.pool = [];
        this.active = [];

        // Başlangıç objelerini oluştur
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(factory());
        }

        // İstatistikler
        this.stats = {
            totalCreated: initialSize,
            peakActive: 0,
            acquireCount: 0,
            releaseCount: 0
        };
    }

    /**
     * Havuzdan obje al
     */
    acquire() {
        let obj;

        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            // Havuz boşsa yeni oluştur
            obj = this.factory();
            this.stats.totalCreated++;
        }

        this.active.push(obj);
        this.stats.acquireCount++;
        this.stats.peakActive = Math.max(this.stats.peakActive, this.active.length);

        return obj;
    }

    /**
     * Objeyi havuza geri ver
     */
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index === -1) return false;

        this.active.splice(index, 1);
        this.resetFn(obj);
        this.pool.push(obj);
        this.stats.releaseCount++;

        return true;
    }

    /**
     * Koşula göre objeleri release et
     */
    releaseWhere(predicate) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            if (predicate(this.active[i])) {
                const obj = this.active[i];
                this.active.splice(i, 1);
                this.resetFn(obj);
                this.pool.push(obj);
                this.stats.releaseCount++;
            }
        }
    }

    /**
     * Tüm aktif objeleri release et
     */
    releaseAll() {
        while (this.active.length > 0) {
            const obj = this.active.pop();
            this.resetFn(obj);
            this.pool.push(obj);
            this.stats.releaseCount++;
        }
    }

    /**
     * Aktif objeleri iterate et
     */
    forEach(callback) {
        for (let i = 0; i < this.active.length; i++) {
            callback(this.active[i], i);
        }
    }

    /**
     * Aktif objeleri filtrele ve döndür
     */
    filter(predicate) {
        return this.active.filter(predicate);
    }

    /**
     * Aktif obje sayısı
     */
    get activeCount() {
        return this.active.length;
    }

    /**
     * Havuzdaki boş obje sayısı
     */
    get availableCount() {
        return this.pool.length;
    }

    /**
     * İstatistikleri al
     */
    getStats() {
        return {
            ...this.stats,
            active: this.active.length,
            available: this.pool.length
        };
    }
}

// ============================================
// ÖNCEDEN TANIMLI HAVUZLAR
// ============================================

/**
 * Partikül havuzu factory
 */
export function createParticlePool(maxParticles = 1000) {
    return new ObjectPool(
        // Factory
        () => ({
            x: 0, y: 0, z: 0,
            vx: 0, vy: 0, vz: 0,
            life: 0, maxLife: 1,
            size: 1,
            color: '#fff',
            alpha: 1,
            gravity: 0,
            active: false
        }),
        // Reset
        (p) => {
            p.x = 0; p.y = 0; p.z = 0;
            p.vx = 0; p.vy = 0; p.vz = 0;
            p.life = 0; p.maxLife = 1;
            p.size = 1;
            p.color = '#fff';
            p.alpha = 1;
            p.gravity = 0;
            p.active = false;
            return p;
        },
        maxParticles
    );
}

/**
 * Projectile havuzu factory
 */
export function createProjectilePool(maxProjectiles = 100) {
    return new ObjectPool(
        // Factory
        () => ({
            x: 0, y: 0,
            vx: 0, vy: 0,
            type: 'bullet',
            damage: 0,
            owner: 'player',
            life: 0,
            active: false
        }),
        // Reset
        (p) => {
            p.x = 0; p.y = 0;
            p.vx = 0; p.vy = 0;
            p.type = 'bullet';
            p.damage = 0;
            p.owner = 'player';
            p.life = 0;
            p.active = false;
            return p;
        },
        maxProjectiles
    );
}

/**
 * Damage number havuzu factory
 */
export function createDamageNumberPool(maxNumbers = 50) {
    return new ObjectPool(
        // Factory
        () => ({
            x: 0, y: 0,
            damage: 0,
            isCrit: false,
            life: 0,
            vy: 0,
            active: false
        }),
        // Reset
        (dn) => {
            dn.x = 0; dn.y = 0;
            dn.damage = 0;
            dn.isCrit = false;
            dn.life = 0;
            dn.vy = 0;
            dn.active = false;
            return dn;
        },
        maxNumbers
    );
}

// ============================================
// ARRAY POOL (Geçici array'ler için)
// ============================================

/**
 * Array Pool - geçici array allocation'ları önlemek için
 */
export class ArrayPool {
    constructor(initialSize = 10, arrayLength = 100) {
        this.pool = [];
        this.arrayLength = arrayLength;

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new Array(arrayLength));
        }
    }

    /**
     * Array al
     */
    acquire() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return new Array(this.arrayLength);
    }

    /**
     * Array'i geri ver
     */
    release(arr) {
        arr.length = 0; // İçeriği temizle
        this.pool.push(arr);
    }
}

// Global array pool
const globalArrayPool = new ArrayPool(10, 100);

export function acquireArray() {
    return globalArrayPool.acquire();
}

export function releaseArray(arr) {
    globalArrayPool.release(arr);
}
