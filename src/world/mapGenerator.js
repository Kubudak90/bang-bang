// MapGenerator - procedural dungeon generation

/**
 * Procedural harita oluştur
 * BSP (Binary Space Partitioning) benzeri oda yerleştirme
 */
export function generateMap(width = 32, height = 32, seed = null) {
    // Seed ile random kontrolü
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

    // Spawn ve çıkış noktaları
    const spawnRoom = rooms[0];
    const exitRoom = rooms[rooms.length - 1];

    const spawnPoint = {
        x: spawnRoom.x + Math.floor(spawnRoom.width / 2) + 0.5,
        y: spawnRoom.y + Math.floor(spawnRoom.height / 2) + 0.5
    };

    const exitPoint = {
        x: exitRoom.x + Math.floor(exitRoom.width / 2),
        y: exitRoom.y + Math.floor(exitRoom.height / 2)
    };

    // Düşman spawn noktaları (spawn odası hariç)
    const enemySpawns = [];
    for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        // İlk odaya yakın odalarda daha fazla düşman
        const count = i === 1 ? 2 : 1 + Math.floor(rng() * 3); // İlk komşu odada 2, diğerlerinde 1-3

        for (let j = 0; j < count; j++) {
            // Oda içinde güvenli spawn (duvardan uzak)
            const spawnX = room.x + 2 + Math.floor(rng() * Math.max(1, room.width - 4)) + 0.5;
            const spawnY = room.y + 2 + Math.floor(rng() * Math.max(1, room.height - 4)) + 0.5;

            enemySpawns.push({
                x: spawnX,
                y: spawnY,
                room: i
            });
        }
    }

    // Loot spawn noktaları
    const lootSpawns = [];
    for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        if (rng() > 0.4) { // %60 şans
            lootSpawns.push({
                x: room.x + 1 + Math.floor(rng() * (room.width - 2)) + 0.5,
                y: room.y + 1 + Math.floor(rng() * (room.height - 2)) + 0.5,
                room: i
            });
        }
    }

    return {
        data,
        width,
        height,
        rooms,
        corridors,
        spawnPoint,
        exitPoint,
        enemySpawns,
        lootSpawns,

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
            if (roomsOverlap(room, other, 2)) { // 2 tile margin
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
    // Duvar tipi seç (oda için)
    const wallTypes = [1, 2, 3, 4];
    const wallType = wallTypes[Math.floor(rng() * wallTypes.length)];

    for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
            // Kenarlar duvar, iç kısım boş
            if (x === room.x || x === room.x + room.width - 1 ||
                y === room.y || y === room.y + room.height - 1) {
                data[y][x] = wallType;
            } else {
                data[y][x] = 0; // Boş alan
            }
        }
    }

    // Odanın duvar tipini kaydet
    room.wallType = wallType;
}

/**
 * İki odayı koridorla bağla
 */
function connectRooms(data, roomA, roomB, rng) {
    // Oda merkezleri
    const ax = Math.floor(roomA.x + roomA.width / 2);
    const ay = Math.floor(roomA.y + roomA.height / 2);
    const bx = Math.floor(roomB.x + roomB.width / 2);
    const by = Math.floor(roomB.y + roomB.height / 2);

    const corridor = { points: [] };

    // L-şeklinde koridor (önce yatay, sonra dikey veya tersi)
    if (rng() > 0.5) {
        // Önce yatay
        carveHorizontalCorridor(data, ax, bx, ay, corridor);
        carveVerticalCorridor(data, ay, by, bx, corridor);
    } else {
        // Önce dikey
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

            // Koridor duvarları
            if (data[y - 1] && data[y - 1][x] !== 0) data[y - 1][x] = 3; // Metal duvar
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

            // Koridor duvarları
            if (data[y][x - 1] !== 0) data[y][x - 1] = 3;
            if (data[y][x + 1] !== 0) data[y][x + 1] = 3;
        }
    }
}

/**
 * Basit seeded random number generator
 */
function createRNG(seed) {
    let s = seed;
    return function() {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/**
 * Debug: Haritayı konsola yazdır
 */
export function printMap(map) {
    const chars = { 0: '.', 1: '#', 2: '%', 3: '=', 4: '+' };
    for (let y = 0; y < map.height; y++) {
        let row = '';
        for (let x = 0; x < map.width; x++) {
            row += chars[map.data[y][x]] || '?';
        }
        console.log(row);
    }
}
