// MapGenerator - procedural dungeon generation (Server-side)
// MUST match client-side algorithm exactly for same seed = same map

/**
 * Basit seeded random number generator
 * Uses LCG algorithm - must match client
 */
function createRNG(seed) {
    let s = seed;
    return function() {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/**
 * Procedural harita oluştur
 * BSP (Binary Space Partitioning) benzeri oda yerleştirme
 */
export function generateMap(width = 32, height = 32, seed = null) {
    const rng = createRNG(seed || Date.now());

    // Boş harita (tüm duvar)
    const data = [];
    for (let y = 0; y < height; y++) {
        data[y] = [];
        for (let x = 0; x < width; x++) {
            data[y][x] = 1; // Başlangıçta her yer duvar
        }
    }

    const rooms = [];
    const corridors = [];

    // Oda oluştur
    const roomCount = 5 + Math.floor(rng() * 4); // 5-8 oda

    for (let i = 0; i < roomCount; i++) {
        const room = tryPlaceRoom(data, rooms, width, height, rng);
        if (room) {
            rooms.push(room);
            carveRoom(data, room, rng);
        }
    }

    // Odaları koridorlarla bağla
    for (let i = 1; i < rooms.length; i++) {
        const corridor = connectRooms(data, rooms[i - 1], rooms[i], rng);
        corridors.push(corridor);
    }

    // Son odayı ilk odaya bağla (döngüsel bağlantı)
    if (rooms.length > 2) {
        connectRooms(data, rooms[rooms.length - 1], rooms[0], rng);
    }

    // Spawn noktaları
    const spawnPoints = generateSpawnPoints(rooms, rng);

    return {
        data,
        width,
        height,
        rooms,
        corridors,
        spawnPoints,

        isWall(x, y) {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return true;
            }
            return this.data[Math.floor(y)][Math.floor(x)] !== 0;
        },

        getTile(x, y) {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return 1;
            }
            return this.data[Math.floor(y)][Math.floor(x)];
        }
    };
}

/**
 * Spawn noktaları oluştur
 */
function generateSpawnPoints(rooms, rng) {
    const points = [];

    for (const room of rooms) {
        // Her odanın merkezine yakın spawn noktası
        points.push({
            x: room.x + Math.floor(room.width / 2) + 0.5,
            y: room.y + Math.floor(room.height / 2) + 0.5
        });

        // Büyük odalarda ekstra spawn
        if (room.width >= 6 && room.height >= 6) {
            points.push({
                x: room.x + 2 + 0.5,
                y: room.y + 2 + 0.5
            });
            points.push({
                x: room.x + room.width - 3 + 0.5,
                y: room.y + room.height - 3 + 0.5
            });
        }
    }

    return points;
}

/**
 * Oda yerleştirmeyi dene
 */
function tryPlaceRoom(data, existingRooms, mapWidth, mapHeight, rng) {
    const minSize = 4;
    const maxSize = 8;
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const width = minSize + Math.floor(rng() * (maxSize - minSize));
        const height = minSize + Math.floor(rng() * (maxSize - minSize));
        const x = 2 + Math.floor(rng() * (mapWidth - width - 4));
        const y = 2 + Math.floor(rng() * (mapHeight - height - 4));

        const room = { x, y, width, height };

        // Diğer odalarla çakışma kontrolü
        let overlaps = false;
        for (const other of existingRooms) {
            if (roomsOverlap(room, other, 2)) {
                overlaps = true;
                break;
            }
        }

        if (!overlaps) {
            return room;
        }
    }

    return null;
}

/**
 * İki oda çakışıyor mu?
 */
function roomsOverlap(a, b, margin = 0) {
    return !(a.x + a.width + margin <= b.x ||
             b.x + b.width + margin <= a.x ||
             a.y + a.height + margin <= b.y ||
             b.y + b.height + margin <= a.y);
}

/**
 * Odayı haritaya kazı
 */
function carveRoom(data, room, rng) {
    const wallTypes = [1, 2, 3, 4];
    const wallType = wallTypes[Math.floor(rng() * wallTypes.length)];

    for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
            if (x === room.x || x === room.x + room.width - 1 ||
                y === room.y || y === room.y + room.height - 1) {
                data[y][x] = wallType;
            } else {
                data[y][x] = 0;
            }
        }
    }

    room.wallType = wallType;
}

/**
 * İki odayı koridorla bağla
 */
function connectRooms(data, roomA, roomB, rng) {
    const ax = Math.floor(roomA.x + roomA.width / 2);
    const ay = Math.floor(roomA.y + roomA.height / 2);
    const bx = Math.floor(roomB.x + roomB.width / 2);
    const by = Math.floor(roomB.y + roomB.height / 2);

    const corridor = { points: [] };

    if (rng() > 0.5) {
        carveHorizontalCorridor(data, ax, bx, ay, corridor);
        carveVerticalCorridor(data, ay, by, bx, corridor);
    } else {
        carveVerticalCorridor(data, ay, by, ax, corridor);
        carveHorizontalCorridor(data, ax, bx, by, corridor);
    }

    return corridor;
}

/**
 * Yatay koridor kazı
 */
function carveHorizontalCorridor(data, x1, x2, y, corridor) {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);

    for (let x = startX; x <= endX; x++) {
        if (data[y] && data[y][x] !== undefined) {
            data[y][x] = 0;
            corridor.points.push({ x, y });

            if (data[y - 1] && data[y - 1][x] !== 0) data[y - 1][x] = 3;
            if (data[y + 1] && data[y + 1][x] !== 0) data[y + 1][x] = 3;
        }
    }
}

/**
 * Dikey koridor kazı
 */
function carveVerticalCorridor(data, y1, y2, x, corridor) {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);

    for (let y = startY; y <= endY; y++) {
        if (data[y] && data[y][x] !== undefined) {
            data[y][x] = 0;
            corridor.points.push({ x, y });

            if (data[y][x - 1] !== 0) data[y][x - 1] = 3;
            if (data[y][x + 1] !== 0) data[y][x + 1] = 3;
        }
    }
}
