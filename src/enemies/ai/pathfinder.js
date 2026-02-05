// Pathfinder - A* pathfinding sistemi
// Düşmanlar için akıllı yol bulma

/**
 * Priority Queue (min-heap) - A* için
 */
class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    push(item, priority) {
        this.heap.push({ item, priority });
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        const top = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return top.item;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    bubbleUp(idx) {
        while (idx > 0) {
            const parent = Math.floor((idx - 1) / 2);
            if (this.heap[parent].priority <= this.heap[idx].priority) break;
            [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
            idx = parent;
        }
    }

    bubbleDown(idx) {
        const length = this.heap.length;
        while (true) {
            const left = 2 * idx + 1;
            const right = 2 * idx + 2;
            let smallest = idx;

            if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
                smallest = left;
            }
            if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
                smallest = right;
            }
            if (smallest === idx) break;

            [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
            idx = smallest;
        }
    }
}

/**
 * A* Pathfinding sınıfı
 */
export class Pathfinder {
    constructor() {
        this.cache = new Map(); // Path cache
        this.cacheTimeout = 1000; // 1 saniye cache
    }

    /**
     * A* ile yol bul
     * @param {Object} map - Harita objesi (isWall metodu olmalı)
     * @param {number} startX - Başlangıç X (world koordinatı)
     * @param {number} startY - Başlangıç Y
     * @param {number} endX - Hedef X
     * @param {number} endY - Hedef Y
     * @param {number} maxIterations - Maksimum iterasyon (performans için)
     * @returns {Array|null} Yol noktaları veya null
     */
    findPath(map, startX, startY, endX, endY, maxIterations = 500) {
        // Grid koordinatlarına çevir
        const start = { x: Math.floor(startX), y: Math.floor(startY) };
        const end = { x: Math.floor(endX), y: Math.floor(endY) };

        // Başlangıç ve hedef aynıysa
        if (start.x === end.x && start.y === end.y) {
            return [{ x: endX, y: endY }];
        }

        // Hedef duvarsa en yakın açık noktayı bul
        if (map.isWall(end.x, end.y)) {
            const nearestOpen = this.findNearestOpen(map, end.x, end.y);
            if (!nearestOpen) return null;
            end.x = nearestOpen.x;
            end.y = nearestOpen.y;
        }

        // Cache kontrolü
        const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.time < this.cacheTimeout) {
            return this.adjustPathStart(cached.path, startX, startY);
        }

        // A* algoritması
        const openSet = new PriorityQueue();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${start.x},${start.y}`;
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, end));
        openSet.push(start, fScore.get(startKey));

        let iterations = 0;

        while (!openSet.isEmpty() && iterations < maxIterations) {
            iterations++;
            const current = openSet.pop();
            const currentKey = `${current.x},${current.y}`;

            // Hedefe ulaştık
            if (current.x === end.x && current.y === end.y) {
                const path = this.reconstructPath(cameFrom, current, startX, startY, endX, endY);
                this.cache.set(cacheKey, { path, time: Date.now() });
                return path;
            }

            closedSet.add(currentKey);

            // Komşuları kontrol et (8 yönlü)
            const neighbors = this.getNeighbors(map, current);

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (closedSet.has(neighborKey)) continue;

                // Diagonal hareket için ek maliyet
                const moveCost = (neighbor.x !== current.x && neighbor.y !== current.y)
                    ? 1.414 : 1;

                const tentativeG = gScore.get(currentKey) + moveCost;

                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, end));
                    openSet.push(neighbor, fScore.get(neighborKey));
                }
            }
        }

        // Yol bulunamadı
        return null;
    }

    /**
     * Heuristic fonksiyonu (Euclidean distance)
     */
    heuristic(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    /**
     * Geçerli komşuları al
     */
    getNeighbors(map, node) {
        const neighbors = [];
        const dirs = [
            { x: 0, y: -1 },  // Yukarı
            { x: 1, y: 0 },   // Sağ
            { x: 0, y: 1 },   // Aşağı
            { x: -1, y: 0 },  // Sol
            { x: 1, y: -1 },  // Sağ-Yukarı
            { x: 1, y: 1 },   // Sağ-Aşağı
            { x: -1, y: 1 },  // Sol-Aşağı
            { x: -1, y: -1 }  // Sol-Yukarı
        ];

        for (const dir of dirs) {
            const nx = node.x + dir.x;
            const ny = node.y + dir.y;

            // Duvar değilse
            if (!map.isWall(nx, ny)) {
                // Diagonal hareketlerde köşe kesme kontrolü
                if (dir.x !== 0 && dir.y !== 0) {
                    // Diagonal: her iki taraf da açık olmalı
                    if (map.isWall(node.x + dir.x, node.y) ||
                        map.isWall(node.x, node.y + dir.y)) {
                        continue; // Köşe kesme yasak
                    }
                }
                neighbors.push({ x: nx, y: ny });
            }
        }

        return neighbors;
    }

    /**
     * Yolu geri oluştur
     */
    reconstructPath(cameFrom, current, startX, startY, endX, endY) {
        const path = [];
        let node = current;

        while (node) {
            // Grid merkezine + hafif offset
            path.unshift({
                x: node.x + 0.5,
                y: node.y + 0.5
            });

            const key = `${node.x},${node.y}`;
            node = cameFrom.get(key);
        }

        // Başlangıç noktasını gerçek pozisyonla değiştir
        if (path.length > 0) {
            path[0] = { x: startX, y: startY };
        }

        // Bitiş noktasını gerçek pozisyonla değiştir
        if (path.length > 1) {
            path[path.length - 1] = { x: endX, y: endY };
        }

        return this.smoothPath(path);
    }

    /**
     * Yolu düzleştir (gereksiz noktaları kaldır)
     */
    smoothPath(path) {
        if (path.length <= 2) return path;

        const smoothed = [path[0]];

        for (let i = 1; i < path.length - 1; i++) {
            const prev = smoothed[smoothed.length - 1];
            const curr = path[i];
            const next = path[i + 1];

            // Açı değişimi kontrolü
            const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);

            // Yön değişikliği varsa noktayı ekle
            if (Math.abs(angle2 - angle1) > 0.1) {
                smoothed.push(curr);
            }
        }

        smoothed.push(path[path.length - 1]);
        return smoothed;
    }

    /**
     * Cache'den alınan yolun başlangıcını ayarla
     */
    adjustPathStart(path, startX, startY) {
        if (!path || path.length === 0) return null;
        const adjusted = [...path];
        adjusted[0] = { x: startX, y: startY };
        return adjusted;
    }

    /**
     * En yakın açık noktayı bul
     */
    findNearestOpen(map, x, y, maxRadius = 5) {
        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) === r || Math.abs(dy) === r) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (!map.isWall(nx, ny)) {
                            return { x: nx, y: ny };
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Cache'i temizle
     */
    clearCache() {
        this.cache.clear();
    }
}

// Singleton instance
let pathfinderInstance = null;

/**
 * Pathfinder instance'ı al
 */
export function getPathfinder() {
    if (!pathfinderInstance) {
        pathfinderInstance = new Pathfinder();
    }
    return pathfinderInstance;
}

/**
 * Basit yol takibi - bir sonraki waypoint'e git
 * @param {Object} entity - Düşman objesi
 * @param {Array} path - Yol noktaları
 * @param {number} waypointRadius - Ne kadar yaklaşınca bir sonraki noktaya geç
 * @returns {Object|null} Hedef pozisyon veya null
 */
export function followPath(entity, path, waypointRadius = 0.5) {
    if (!path || path.length === 0) return null;

    // Mevcut waypoint index'i
    if (entity.pathIndex === undefined) {
        entity.pathIndex = 0;
    }

    // Mevcut hedefe olan mesafe
    const target = path[entity.pathIndex];
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Hedefe ulaştıysa bir sonraki noktaya geç
    if (dist < waypointRadius) {
        entity.pathIndex++;
        if (entity.pathIndex >= path.length) {
            // Yolun sonuna ulaştı
            entity.path = null;
            entity.pathIndex = 0;
            return null;
        }
        return path[entity.pathIndex];
    }

    return target;
}

/**
 * İki nokta arasında görüş hattı var mı?
 * (Pathfinding'e alternatif basit kontrol)
 */
export function hasLineOfSight(map, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist * 2);

    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const checkX = x1 + dx * t;
        const checkY = y1 + dy * t;

        if (map.isWall(Math.floor(checkX), Math.floor(checkY))) {
            return false;
        }
    }
    return true;
}
