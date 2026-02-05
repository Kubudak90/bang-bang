// Keyboard - klavye input yönetimi
// Enhanced: Sprint, crouch, reload keys

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
    sprint: false,    // Shift
    crouch: false,    // Ctrl veya C
    reload: false,    // R
    interact: false   // E
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
        case 'ArrowUp':
            keys.forward = isPressed;
            break;
        case 'KeyS':
        case 'ArrowDown':
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

        // Sprint (Shift)
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.sprint = isPressed;
            break;

        // Crouch (Ctrl veya C)
        case 'ControlLeft':
        case 'ControlRight':
        case 'KeyC':
            keys.crouch = isPressed;
            break;

        // Reload (R)
        case 'KeyR':
            keys.reload = isPressed;
            break;

        // Interact (E)
        case 'KeyE':
            keys.interact = isPressed;
            break;
    }
}
