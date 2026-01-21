// Mouse - fare input yönetimi

import { PLAYER } from '../core/config.js';

let mouseDeltaX = 0;
let mouseDeltaY = 0;
let isPointerLocked = false;

/**
 * Mouse sistemini başlat
 */
export function initMouse(canvas) {
    // Pointer lock için click
    canvas.addEventListener('click', () => {
        if (!isPointerLocked) {
            canvas.requestPointerLock();
        }
    });

    // Pointer lock değişiklik
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement !== null;
    });

    // Mouse hareket
    document.addEventListener('mousemove', handleMouseMove);
}

/**
 * Mouse X delta'sını al ve sıfırla (yatay bakış)
 */
export function consumeMouseDelta() {
    const delta = mouseDeltaX * PLAYER.MOUSE_SENSITIVITY;
    mouseDeltaX = 0;
    return delta;
}

/**
 * Mouse Y delta'sını al ve sıfırla (dikey bakış)
 */
export function consumeMouseDeltaY() {
    const delta = mouseDeltaY * PLAYER.MOUSE_SENSITIVITY;
    mouseDeltaY = 0;
    return delta;
}

/**
 * Pointer lock aktif mi?
 */
export function isLocked() {
    return isPointerLocked;
}

function handleMouseMove(e) {
    if (isPointerLocked) {
        mouseDeltaX += e.movementX;
        mouseDeltaY += e.movementY;
    }
}
