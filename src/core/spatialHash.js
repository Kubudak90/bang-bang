// Spatial Hash - düşman/entity collision optimizasyonu
// Grid tabanlı spatial partitioning

/**
 * SpatialHash sınıfı - hızlı yakınlık sorguları için
 */
export class SpatialHash {
    constructor(cellSize = 4) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.entityCells = new Map(); // Entity -> cell key mapping
    }

    /**
     * Cell key hesapla
     */
    getKey(x, y) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }

    /**
     * Tüm cell'leri temizle
     */
    clear() {
        this.cells.clear();
        this.entityCells.clear();
    }

    /**
     * Entity ekle
     */
    insert(entity) {
        const key = this.getKey(entity.x, entity.y);

        // Eski cell'den kaldır (varsa)
        this.remove(entity);

        // Yeni cell'e ekle
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }
        this.cells.get(key).add(entity);
        this.entityCells.set(entity, key);
    }

    /**
     * Entity kaldır
     */
    remove(entity) {
        const oldKey = this.entityCells.get(entity);
        if (oldKey) {
            const cell = this.cells.get(oldKey);
            if (cell) {
                cell.delete(entity);
                if (cell.size === 0) {
                    this.cells.delete(oldKey);
                }
            }
            this.entityCells.delete(entity);
        }
    }

    /**
     * Entity pozisyonunu güncelle
     */
    update(entity) {
        const newKey = this.getKey(entity.x, entity.y);
        const oldKey = this.entityCells.get(entity);

        // Cell değiştiyse güncelle
        if (newKey !== oldKey) {
            this.insert(entity);
        }
    }

    /**
     * Yakındaki entity'leri sorgula
     * @param {number} x - Merkez X
     * @param {number} y - Merkez Y
     * @param {number} radius - Arama yarıçapı
     * @returns {Array} Yakındaki entity'ler
     */
    query(x, y, radius) {
        const results = [];
        const cellRadius = Math.ceil(radius / this.cellSize);

        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        // Yakın cell'leri kontrol et
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                const cell = this.cells.get(key);

                if (cell) {
                    for (const entity of cell) {
                        // Gerçek mesafe kontrolü
                        const distSq = (entity.x - x) ** 2 + (entity.y - y) ** 2;
                        if (distSq <= radius * radius) {
                            results.push(entity);
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Ray cast ile kesişen entity'leri bul
     */
    raycast(startX, startY, angle, maxDist, filter = null) {
        const results = [];
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        const steps = Math.ceil(maxDist / (this.cellSize / 2));

        const checkedCells = new Set();

        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * maxDist;
            const x = startX + dirX * t;
            const y = startY + dirY * t;
            const key = this.getKey(x, y);

            if (checkedCells.has(key)) continue;
            checkedCells.add(key);

            const cell = this.cells.get(key);
            if (cell) {
                for (const entity of cell) {
                    if (filter && !filter(entity)) continue;
                    if (results.includes(entity)) continue;

                    // Ray-circle intersection
                    const hit = this.rayCircleIntersect(
                        startX, startY, dirX, dirY,
                        entity.x, entity.y, entity.radius || 0.5,
                        maxDist
                    );

                    if (hit !== null) {
                        results.push({ entity, distance: hit });
                    }
                }
            }
        }

        // Mesafeye göre sırala
        results.sort((a, b) => a.distance - b.distance);
        return results;
    }

    /**
     * Ray-circle kesişim testi
     */
    rayCircleIntersect(rx, ry, rdx, rdy, cx, cy, cr, maxDist) {
        const dx = cx - rx;
        const dy = cy - ry;

        const a = rdx * rdx + rdy * rdy;
        const b = -2 * (dx * rdx + dy * rdy);
        const c = dx * dx + dy * dy - cr * cr;

        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) return null;

        const t = (-b - Math.sqrt(discriminant)) / (2 * a);

        if (t >= 0 && t <= maxDist) {
            return t;
        }

        return null;
    }

    /**
     * Debug: cell sayısını al
     */
    getCellCount() {
        return this.cells.size;
    }

    /**
     * Debug: toplam entity sayısını al
     */
    getEntityCount() {
        return this.entityCells.size;
    }
}

// Singleton instance
let spatialHashInstance = null;

/**
 * Global spatial hash instance al
 */
export function getSpatialHash() {
    if (!spatialHashInstance) {
        spatialHashInstance = new SpatialHash(4);
    }
    return spatialHashInstance;
}

/**
 * Spatial hash'i sıfırla
 */
export function resetSpatialHash() {
    if (spatialHashInstance) {
        spatialHashInstance.clear();
    }
}
