// Player - pozisyon, açı, hareket
// Enhanced: Acceleration-based movement, head bob, sprint/crouch

import { PLAYER, SCREEN } from '../core/config.js';
import { normalizeAngle } from '../core/utils.js';
import { getKeys } from '../input/keyboard.js';
import { consumeMouseDelta, consumeMouseDeltaY } from '../input/mouse.js';
import { game } from '../core/game.js';

// Dikey bakış limitleri
const MAX_PITCH = SCREEN.HEIGHT * 0.4;

// Oyuncu durumları
export const PLAYER_STATE = {
    STANDING: 'standing',
    CROUCHING: 'crouching',
    SPRINTING: 'sprinting'
};

export function createPlayer() {
    return {
        x: PLAYER.START_X,
        y: PLAYER.START_Y,
        angle: PLAYER.START_ANGLE,
        pitch: 0,
        radius: PLAYER.RADIUS,
        health: 100,
        maxHealth: 100,

        // Velocity-based movement
        velX: 0,
        velY: 0,

        // Hareket durumu
        state: PLAYER_STATE.STANDING,
        isSprinting: false,
        isCrouching: false,
        isMoving: false,

        // Head bob
        headBobPhase: 0,
        headBobOffset: 0,
        headBobSideOffset: 0,

        // View kick (silah geri tepmesi)
        viewKickPitch: 0,
        viewKickYaw: 0,

        // Crouch transition
        crouchAmount: 0, // 0 = ayakta, 1 = tam eğilmiş
        heightMultiplier: 1.0
    };
}

/**
 * Player'ı güncelle (her frame)
 */
export function updatePlayer(player, map) {
    const dt = game.deltaTime;
    const keys = getKeys();

    // --- Durum Kontrolü ---
    updatePlayerState(player, keys);

    // --- Yatay Dönme ---
    updateRotation(player, keys, dt);

    // --- Dikey Bakış (Pitch) ---
    updatePitch(player);

    // --- View Kick Recovery ---
    updateViewKick(player, dt);

    // --- Hareket (Velocity-based) ---
    updateMovement(player, keys, map, dt);

    // --- Head Bob ---
    updateHeadBob(player, dt);

    // --- Crouch Transition ---
    updateCrouch(player, dt);
}

/**
 * Oyuncu durumunu güncelle (sprint/crouch)
 */
function updatePlayerState(player, keys) {
    // Sprint kontrolü (Shift)
    if (keys.sprint && !player.isCrouching) {
        player.isSprinting = true;
        player.state = PLAYER_STATE.SPRINTING;
    } else {
        player.isSprinting = false;
    }

    // Crouch kontrolü (Ctrl veya C)
    if (keys.crouch) {
        player.isCrouching = true;
        player.isSprinting = false; // Eğilirken koşulamaz
        player.state = PLAYER_STATE.CROUCHING;
    } else {
        player.isCrouching = false;
    }

    // Normal durum
    if (!player.isSprinting && !player.isCrouching) {
        player.state = PLAYER_STATE.STANDING;
    }
}

/**
 * Yatay dönme güncelle
 */
function updateRotation(player, keys, dt) {
    const mouseDeltaX = consumeMouseDelta();
    player.angle += mouseDeltaX;

    // Klavye ile dönme
    if (keys.turnLeft) {
        player.angle -= PLAYER.ROTATION_SPEED * dt;
    }
    if (keys.turnRight) {
        player.angle += PLAYER.ROTATION_SPEED * dt;
    }

    // View kick yaw uygula
    player.angle += player.viewKickYaw * dt;

    player.angle = normalizeAngle(player.angle);
}

/**
 * Dikey bakış güncelle
 */
function updatePitch(player) {
    const mouseDeltaY = consumeMouseDeltaY();
    player.pitch -= mouseDeltaY * 150;

    // View kick pitch uygula
    player.pitch += player.viewKickPitch;

    // Pitch limitleri
    player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch));
}

/**
 * View kick (silah geri tepmesi) toparlanması
 */
function updateViewKick(player, dt) {
    const recovery = PLAYER.VIEW_KICK_RECOVERY * dt;

    // Pitch kick toparlanması
    if (Math.abs(player.viewKickPitch) > 0.01) {
        player.viewKickPitch *= (1 - recovery);
    } else {
        player.viewKickPitch = 0;
    }

    // Yaw kick toparlanması
    if (Math.abs(player.viewKickYaw) > 0.001) {
        player.viewKickYaw *= (1 - recovery);
    } else {
        player.viewKickYaw = 0;
    }
}

/**
 * İvmeli hareket sistemi
 */
function updateMovement(player, keys, map, dt) {
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);

    // Hedef hız hesapla
    let targetVelX = 0;
    let targetVelY = 0;

    // Hız çarpanı
    let speedMult = 1.0;
    if (player.isSprinting) {
        speedMult = PLAYER.SPRINT_MULTIPLIER;
    } else if (player.isCrouching) {
        // Nimble perk: eğilme cezasını kaldırabilir
        speedMult = player.perkMods?.crouchSpeedPenalty ?? PLAYER.CROUCH_MULTIPLIER;
    }

    // Perk hız çarpanı
    const perkSpeedMult = player.perkMods?.speedMultiplier ?? 1.0;
    const maxSpeed = PLAYER.MOVE_SPEED * speedMult * perkSpeedMult;

    // İleri/geri
    if (keys.forward) {
        targetVelX += cos;
        targetVelY += sin;
    }
    if (keys.backward) {
        targetVelX -= cos;
        targetVelY -= sin;
    }

    // Strafe
    if (keys.left) {
        targetVelX += sin;
        targetVelY -= cos;
    }
    if (keys.right) {
        targetVelX -= sin;
        targetVelY += cos;
    }

    // Normalize et (diagonal hareket aynı hızda olsun)
    const targetLen = Math.sqrt(targetVelX * targetVelX + targetVelY * targetVelY);
    if (targetLen > 0) {
        targetVelX = (targetVelX / targetLen) * maxSpeed;
        targetVelY = (targetVelY / targetLen) * maxSpeed;
        player.isMoving = true;
    } else {
        player.isMoving = false;
    }

    // İvme uygula
    const accel = player.isMoving ? PLAYER.ACCELERATION : PLAYER.DECELERATION;

    // Velocity'yi hedefe doğru interpole et
    player.velX = approach(player.velX, targetVelX, accel * dt);
    player.velY = approach(player.velY, targetVelY, accel * dt);

    // Pozisyon güncelle
    const moveX = player.velX * dt;
    const moveY = player.velY * dt;

    // --- Collision ---
    if (!game.debug.noclip) {
        const newX = player.x + moveX;
        const newY = player.y + moveY;

        // X ekseni
        if (!isColliding(newX, player.y, player.radius, map)) {
            player.x = newX;
        } else {
            player.velX = 0; // Duvara çarpınca velocity sıfırla
        }

        // Y ekseni
        if (!isColliding(player.x, newY, player.radius, map)) {
            player.y = newY;
        } else {
            player.velY = 0;
        }
    } else {
        player.x += moveX;
        player.y += moveY;
    }
}

/**
 * Head bob güncelle
 */
function updateHeadBob(player, dt) {
    // Mevcut hız
    const speed = Math.sqrt(player.velX * player.velX + player.velY * player.velY);
    const maxSpeed = PLAYER.MOVE_SPEED * (player.isSprinting ? PLAYER.SPRINT_MULTIPLIER : 1);
    const speedRatio = speed / maxSpeed;

    if (speedRatio > 0.1) {
        // Bob hızı
        let bobSpeed = PLAYER.HEAD_BOB_SPEED;
        if (player.isSprinting) {
            bobSpeed *= PLAYER.HEAD_BOB_SPRINT_MULT;
        } else if (player.isCrouching) {
            bobSpeed *= 0.7;
        }

        // Phase güncelle
        player.headBobPhase += bobSpeed * dt;

        // Dikey bob (sin wave)
        const bobAmount = PLAYER.HEAD_BOB_AMOUNT * speedRatio;
        player.headBobOffset = Math.sin(player.headBobPhase) * bobAmount;

        // Yatay bob (daha yavaş, daha az)
        player.headBobSideOffset = Math.sin(player.headBobPhase * 0.5) * bobAmount * 0.5;
    } else {
        // Duruyorken bob sıfırla (smooth)
        player.headBobOffset *= 0.9;
        player.headBobSideOffset *= 0.9;
        player.headBobPhase = 0;
    }
}

/**
 * Crouch geçişi (smooth)
 */
function updateCrouch(player, dt) {
    const targetCrouch = player.isCrouching ? 1 : 0;
    const crouchSpeed = 8.0; // Geçiş hızı

    player.crouchAmount = approach(player.crouchAmount, targetCrouch, crouchSpeed * dt);

    // Yükseklik çarpanı
    player.heightMultiplier = 1.0 - (player.crouchAmount * (1 - PLAYER.CROUCH_HEIGHT));
}

/**
 * View kick uygula (silah ateşinde çağrılır)
 * @param {Object} player
 * @param {number} pitchKick - Yukarı kick miktarı
 * @param {number} yawKick - Yatay kick miktarı (opsiyonel, spread için)
 */
export function applyViewKick(player, pitchKick, yawKick = 0) {
    player.viewKickPitch += pitchKick;
    player.viewKickYaw += yawKick;
}

/**
 * Oyuncunun mevcut hızını al
 */
export function getPlayerSpeed(player) {
    return Math.sqrt(player.velX * player.velX + player.velY * player.velY);
}

/**
 * Oyuncunun head bob offset'ini al (render için)
 */
export function getHeadBobOffset(player) {
    return {
        vertical: player.headBobOffset,
        horizontal: player.headBobSideOffset
    };
}

/**
 * Collision kontrolü
 */
function isColliding(x, y, radius, map) {
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

/**
 * Değeri hedefe doğru yaklaştır
 */
function approach(current, target, delta) {
    const diff = target - current;
    if (Math.abs(diff) <= delta) {
        return target;
    }
    return current + Math.sign(diff) * delta;
}
