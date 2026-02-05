// Oyun sabitleri - magic number yasak, her şey burada

export const SCREEN = {
    WIDTH: 640,
    HEIGHT: 400,
    SCALE: 2 // CSS scaling
};

export const PLAYER = {
    // Temel hareket
    MOVE_SPEED: 4.0,           // maksimum hız (birim/saniye)
    ROTATION_SPEED: 2.0,       // radyan/saniye (klavye için)
    MOUSE_SENSITIVITY: 0.002,
    RADIUS: 0.25,              // collision için
    START_X: 2.5,
    START_Y: 2.5,
    START_ANGLE: 0,

    // İvmeli hareket sistemi
    ACCELERATION: 35.0,        // hızlanma oranı
    DECELERATION: 15.0,        // yavaşlama (friction)
    AIR_CONTROL: 0.3,          // havada kontrol (gelecek zıplama için)

    // Koşma ve eğilme
    SPRINT_MULTIPLIER: 1.6,    // koşarken hız çarpanı
    CROUCH_MULTIPLIER: 0.5,    // eğilirken hız çarpanı
    CROUCH_HEIGHT: 0.6,        // eğilme yüksekliği (1.0 = normal)

    // Head bob
    HEAD_BOB_SPEED: 12.0,      // sallanma hızı
    HEAD_BOB_AMOUNT: 3.0,      // sallanma miktarı (piksel)
    HEAD_BOB_SPRINT_MULT: 1.5, // koşarken sallanma artışı

    // View kick
    VIEW_KICK_RECOVERY: 8.0,   // silah ateşi sonrası toparlanma hızı
    VIEW_KICK_AMOUNT: 2.0      // varsayılan geri tepme
};

export const RAYCASTER = {
    FOV: Math.PI / 3,     // 60 derece
    MAX_DEPTH: 20,        // maksimum görüş mesafesi
    WALL_HEIGHT: 1.0      // birim cinsinden duvar yüksekliği
};

export const COLORS = {
    CEILING: '#1a1a2e',
    FLOOR: '#16213e',
    WALL_NORTH: '#e94560',
    WALL_SOUTH: '#c73e54',
    WALL_EAST: '#0f3460',
    WALL_WEST: '#0a2647',
    MINIMAP_BG: 'rgba(0, 0, 0, 0.7)',
    MINIMAP_WALL: '#fff',
    MINIMAP_PLAYER: '#0f0',
    MINIMAP_RAY: 'rgba(255, 255, 0, 0.3)'
};

export const DEBUG = {
    SHOW_FPS: true,
    SHOW_MINIMAP: false,  // Kapalı - sürpriz karşılaşmalar için
    SHOW_RAYS: false,
    MINIMAP_SCALE: 8,
    MINIMAP_PADDING: 10
};

// Network configuration
const IS_PRODUCTION = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export const NETWORK = {
    // Production: Railway/Render URL'inizi buraya yazın
    // Development: localhost
    SERVER_URL: IS_PRODUCTION
        ? 'wss://bang-bang-server-production.up.railway.app'
        : 'ws://localhost:3001',
    TICK_RATE: 20,              // Server updates per second
    INTERPOLATION_DELAY: 100,   // ms behind server time
    RECONCILE_THRESHOLD: 0.5,   // Position error for correction
    INPUT_BUFFER_SIZE: 64,      // Input history size
    STATE_BUFFER_SIZE: 20       // State history for interpolation
};

// Match configuration
export const MATCH = {
    DURATION: 300,              // 5 minutes
    RESPAWN_TIME: 3,            // seconds
    MAX_PLAYERS: 8,
    MIN_PLAYERS_TO_START: 1,    // 1 for testing, 2 for production
    COUNTDOWN_TIME: 3           // seconds before match start
};

// Remote player colors (for identification)
export const PLAYER_COLORS = [
    '#ff4444', // Red
    '#44ff44', // Green
    '#4444ff', // Blue
    '#ffff44', // Yellow
    '#ff44ff', // Magenta
    '#44ffff', // Cyan
    '#ff8844', // Orange
    '#8844ff'  // Purple
];
