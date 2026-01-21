// Player - pozisyon, açı, hareket

import { PLAYER, SCREEN } from '../core/config.js';
import { normalizeAngle } from '../core/utils.js';
import { getKeys } from '../input/keyboard.js';
import { consumeMouseDelta, consumeMouseDeltaY } from '../input/mouse.js';
import { game } from '../core/game.js';

// Dikey bakış limitleri
const MAX_PITCH = SCREEN.HEIGHT * 0.4; // Maksimum yukarı/aşağı bakış

export function createPlayer() {
    return {
        x: PLAYER.START_X,
        y: PLAYER.START_Y,
        angle: PLAYER.START_ANGLE,
        pitch: 0, // Dikey bakış (horizon offset)
        radius: PLAYER.RADIUS,
        health: 100,
        maxHealth: 100
    };
}

/**
 * Player'ı güncelle (her frame)
 */
export function updatePlayer(player, map) {
    const dt = game.deltaTime;
    const keys = getKeys();

    // --- Yatay Dönme ---
    const mouseDeltaX = consumeMouseDelta();
    player.angle += mouseDeltaX;

    // Klavye ile dönme (backup/alternatif)
    if (keys.turnLeft) {
        player.angle -= PLAYER.ROTATION_SPEED * dt;
    }
    if (keys.turnRight) {
        player.angle += PLAYER.ROTATION_SPEED * dt;
    }

    // Açıyı normalize et
    player.angle = normalizeAngle(player.angle);

    // --- Dikey Bakış (Pitch) ---
    const mouseDeltaY = consumeMouseDeltaY();
    player.pitch -= mouseDeltaY * 150; // Sensitivity ayarı

    // Pitch'i limitle
    player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch));
    
    // --- Hareket ---
    let moveX = 0;
    let moveY = 0;
    
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    const speed = PLAYER.MOVE_SPEED * dt;
    
    // İleri/geri
    if (keys.forward) {
        moveX += cos * speed;
        moveY += sin * speed;
    }
    if (keys.backward) {
        moveX -= cos * speed;
        moveY -= sin * speed;
    }
    
    // Strafe (yanlara kayma)
    if (keys.left) {
        moveX += sin * speed;
        moveY -= cos * speed;
    }
    if (keys.right) {
        moveX -= sin * speed;
        moveY += cos * speed;
    }
    
    // --- Collision ---
    if (!game.debug.noclip) {
        // X ve Y ayrı kontrol et (sliding collision)
        const newX = player.x + moveX;
        const newY = player.y + moveY;
        
        // X ekseni
        if (!isColliding(newX, player.y, player.radius, map)) {
            player.x = newX;
        }
        
        // Y ekseni
        if (!isColliding(player.x, newY, player.radius, map)) {
            player.y = newY;
        }
    } else {
        // Noclip: collision yok
        player.x += moveX;
        player.y += moveY;
    }
}

/**
 * Collision kontrolü
 * Player'ın radius'u kadar çevresini kontrol et
 */
function isColliding(x, y, radius, map) {
    // 4 köşeyi kontrol et (basit ama etkili)
    const points = [
        [x - radius, y - radius],
        [x + radius, y - radius],
        [x - radius, y + radius],
        [x + radius, y + radius]
    ];
    
    for (const [px, py] of points) {
        if (map.isWall(Math.floor(px), Math.floor(py))) {
            return true;
        }
    }
    
    return false;
}
