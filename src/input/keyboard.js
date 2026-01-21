// Keyboard - klavye input yönetimi

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false
};

/**
 * Klavye sistemini başlat
 */
export function initKeyboard() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
}

/**
 * Mevcut tuş durumlarını döndür
 */
export function getKeys() {
    return keys;
}

function handleKeyDown(e) {
    updateKey(e.code, true);
}

function handleKeyUp(e) {
    updateKey(e.code, false);
}

function updateKey(code, isPressed) {
    switch (code) {
        // WASD
        case 'KeyW':
            keys.forward = isPressed;
            break;
        case 'KeyS':
            keys.backward = isPressed;
            break;
        case 'KeyA':
            keys.left = isPressed;
            break;
        case 'KeyD':
            keys.right = isPressed;
            break;
        // Ok tuşları (dönme için backup)
        case 'ArrowLeft':
            keys.turnLeft = isPressed;
            break;
        case 'ArrowRight':
            keys.turnRight = isPressed;
            break;
    }
}
