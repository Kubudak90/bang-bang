// Touch Controls - Mobile virtual joysticks
// Left stick: movement, Right stick: look + fire

import { SCREEN } from '../core/config.js';

// ============================================
// CONFIGURATION
// ============================================

const JOYSTICK_CONFIG = {
    SIZE: 140,              // Joystick area diameter (bigger)
    INNER_SIZE: 60,         // Inner knob diameter (bigger)
    DEAD_ZONE: 0.12,        // Ignore small movements (more sensitive)
    OPACITY: 0.6,           // Base opacity (more visible)
    ACTIVE_OPACITY: 0.9,    // Opacity when touched
    MARGIN: 40,             // Distance from screen edge
    LOOK_SENSITIVITY: 0.012 // Mouse sensitivity equivalent (faster turn)
};

// ============================================
// JOYSTICK CLASS
// ============================================

class VirtualJoystick {
    constructor(side) {
        this.side = side; // 'left' or 'right'
        this.touchId = null;
        this.active = false;

        // Base position (where joystick appears)
        this.baseX = 0;
        this.baseY = 0;

        // Current knob position
        this.knobX = 0;
        this.knobY = 0;

        // Normalized values (-1 to 1)
        this.x = 0;
        this.y = 0;

        // For right stick: track tap for shooting
        this.tapped = false;
        this.tapStartTime = 0;
    }

    start(touchX, touchY, touchId) {
        this.touchId = touchId;
        this.active = true;
        this.baseX = touchX;
        this.baseY = touchY;
        this.knobX = touchX;
        this.knobY = touchY;
        this.x = 0;
        this.y = 0;
        this.tapped = false;
        this.tapStartTime = Date.now();
    }

    move(touchX, touchY) {
        if (!this.active) return;

        const dx = touchX - this.baseX;
        const dy = touchY - this.baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = JOYSTICK_CONFIG.SIZE / 2;

        // Clamp to joystick area
        if (distance > maxDistance) {
            this.knobX = this.baseX + (dx / distance) * maxDistance;
            this.knobY = this.baseY + (dy / distance) * maxDistance;
        } else {
            this.knobX = touchX;
            this.knobY = touchY;
        }

        // Normalize to -1 to 1
        this.x = (this.knobX - this.baseX) / maxDistance;
        this.y = (this.knobY - this.baseY) / maxDistance;

        // Apply dead zone
        if (Math.abs(this.x) < JOYSTICK_CONFIG.DEAD_ZONE) this.x = 0;
        if (Math.abs(this.y) < JOYSTICK_CONFIG.DEAD_ZONE) this.y = 0;
    }

    end() {
        // Check if this was a tap (short touch with no movement)
        const tapDuration = Date.now() - this.tapStartTime;
        const moved = Math.abs(this.x) > 0.1 || Math.abs(this.y) > 0.1;

        if (tapDuration < 200 && !moved) {
            this.tapped = true;
        }

        this.touchId = null;
        this.active = false;
        this.x = 0;
        this.y = 0;
    }
}

// ============================================
// TOUCH CONTROLS CLASS
// ============================================

export class TouchControls {
    constructor(canvas) {
        this.canvas = canvas;
        this.enabled = false;

        // Joysticks
        this.leftStick = new VirtualJoystick('left');
        this.rightStick = new VirtualJoystick('right');

        // Weapon buttons state
        this.weaponButtons = [
            { id: 'pistol', key: '1', x: 0, y: 0, pressed: false },
            { id: 'shotgun', key: '2', x: 0, y: 0, pressed: false },
            { id: 'machinegun', key: '3', x: 0, y: 0, pressed: false }
        ];
        this.selectedWeapon = null;

        // Bind methods
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        // Check if touch device
        this.isTouchDevice = this._detectTouchDevice();

        if (this.isTouchDevice) {
            this.enable();
        }
    }

    _detectTouchDevice() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0);
    }

    enable() {
        if (this.enabled) return;

        this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

        this.enabled = true;
        console.log('Touch controls enabled');
    }

    disable() {
        if (!this.enabled) return;

        this.canvas.removeEventListener('touchstart', this._onTouchStart);
        this.canvas.removeEventListener('touchmove', this._onTouchMove);
        this.canvas.removeEventListener('touchend', this._onTouchEnd);
        this.canvas.removeEventListener('touchcancel', this._onTouchEnd);

        this.enabled = false;
    }

    // ============================================
    // TOUCH EVENT HANDLERS
    // ============================================

    _onTouchStart(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = SCREEN.WIDTH / rect.width;
        const scaleY = SCREEN.HEIGHT / rect.height;

        for (const touch of e.changedTouches) {
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;

            // Check weapon buttons first
            const weaponButton = this._hitTestWeaponButtons(x, y);
            if (weaponButton) {
                this.selectedWeapon = weaponButton.id;
                weaponButton.pressed = true;
                continue;
            }

            // Left half = left stick, right half = right stick
            if (x < SCREEN.WIDTH / 2) {
                if (!this.leftStick.active) {
                    this.leftStick.start(x, y, touch.identifier);
                }
            } else {
                if (!this.rightStick.active) {
                    this.rightStick.start(x, y, touch.identifier);
                }
            }
        }
    }

    _onTouchMove(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = SCREEN.WIDTH / rect.width;
        const scaleY = SCREEN.HEIGHT / rect.height;

        for (const touch of e.changedTouches) {
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;

            if (touch.identifier === this.leftStick.touchId) {
                this.leftStick.move(x, y);
            }
            if (touch.identifier === this.rightStick.touchId) {
                this.rightStick.move(x, y);
            }
        }
    }

    _onTouchEnd(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === this.leftStick.touchId) {
                this.leftStick.end();
            }
            if (touch.identifier === this.rightStick.touchId) {
                this.rightStick.end();
            }
        }

        // Reset weapon buttons
        for (const btn of this.weaponButtons) {
            btn.pressed = false;
        }
    }

    _hitTestWeaponButtons(x, y) {
        for (const btn of this.weaponButtons) {
            const dx = x - btn.x;
            const dy = y - btn.y;
            if (dx * dx + dy * dy < 30 * 30) {
                return btn;
            }
        }
        return null;
    }

    // ============================================
    // INPUT GETTERS
    // ============================================

    /**
     * Get current input state (compatible with keyboard input)
     */
    getInput() {
        // Consume tap state
        const shoot = this.rightStick.tapped;
        this.rightStick.tapped = false;

        // Consume weapon selection
        const weapon = this.selectedWeapon;
        this.selectedWeapon = null;

        return {
            // Movement from left stick
            forward: this.leftStick.y < -JOYSTICK_CONFIG.DEAD_ZONE,
            backward: this.leftStick.y > JOYSTICK_CONFIG.DEAD_ZONE,
            left: this.leftStick.x < -JOYSTICK_CONFIG.DEAD_ZONE,
            right: this.leftStick.x > JOYSTICK_CONFIG.DEAD_ZONE,

            // Look delta from right stick (replaces mouse)
            lookDelta: this.rightStick.x * JOYSTICK_CONFIG.LOOK_SENSITIVITY,

            // Shooting (right stick tap or continuous hold)
            shoot: shoot || this.rightStick.active,

            // Weapon switch
            weaponSwitch: weapon,

            // Raw values for UI
            leftStickX: this.leftStick.x,
            leftStickY: this.leftStick.y,
            rightStickX: this.rightStick.x,
            rightStickY: this.rightStick.y
        };
    }

    /**
     * Check if touch controls are active
     */
    isActive() {
        return this.enabled && this.isTouchDevice;
    }

    // ============================================
    // RENDERING
    // ============================================

    /**
     * Render touch controls overlay
     */
    render(ctx) {
        if (!this.enabled || !this.isTouchDevice) return;

        // Left joystick
        this._renderJoystick(ctx, this.leftStick, JOYSTICK_CONFIG.MARGIN + JOYSTICK_CONFIG.SIZE / 2);

        // Right joystick
        this._renderJoystick(ctx, this.rightStick, SCREEN.WIDTH - JOYSTICK_CONFIG.MARGIN - JOYSTICK_CONFIG.SIZE / 2);

        // Weapon buttons
        this._renderWeaponButtons(ctx);
    }

    _renderJoystick(ctx, stick, defaultX) {
        const opacity = stick.active ? JOYSTICK_CONFIG.ACTIVE_OPACITY : JOYSTICK_CONFIG.OPACITY;
        const baseX = stick.active ? stick.baseX : defaultX;
        const baseY = stick.active ? stick.baseY : SCREEN.HEIGHT - JOYSTICK_CONFIG.MARGIN - JOYSTICK_CONFIG.SIZE / 2;
        const knobX = stick.active ? stick.knobX : baseX;
        const knobY = stick.active ? stick.knobY : baseY;

        // Color based on side
        const isLeft = stick.side === 'left';
        const mainColor = isLeft ? '100, 200, 255' : '255, 100, 100'; // Blue for move, Red for aim/fire
        const accentColor = isLeft ? '#4af' : '#f44';

        // Outer ring with glow
        ctx.beginPath();
        ctx.arc(baseX, baseY, JOYSTICK_CONFIG.SIZE / 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${mainColor}, ${opacity})`;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner filled circle (darker)
        ctx.beginPath();
        ctx.arc(baseX, baseY, JOYSTICK_CONFIG.SIZE / 2 - 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.5})`;
        ctx.fill();

        // Cross hair guides
        ctx.strokeStyle = `rgba(${mainColor}, ${opacity * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(baseX - JOYSTICK_CONFIG.SIZE / 2 + 10, baseY);
        ctx.lineTo(baseX + JOYSTICK_CONFIG.SIZE / 2 - 10, baseY);
        ctx.moveTo(baseX, baseY - JOYSTICK_CONFIG.SIZE / 2 + 10);
        ctx.lineTo(baseX, baseY + JOYSTICK_CONFIG.SIZE / 2 - 10);
        ctx.stroke();

        // Knob with gradient effect
        ctx.beginPath();
        ctx.arc(knobX, knobY, JOYSTICK_CONFIG.INNER_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${mainColor}, ${opacity})`;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Knob inner highlight
        ctx.beginPath();
        ctx.arc(knobX - 5, knobY - 5, JOYSTICK_CONFIG.INNER_SIZE / 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
        ctx.fill();

        // Direction indicator for active stick
        if (stick.active && (Math.abs(stick.x) > 0.1 || Math.abs(stick.y) > 0.1)) {
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(knobX, knobY);
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isLeft ? 'MOVE' : 'AIM', baseX, baseY - JOYSTICK_CONFIG.SIZE / 2 - 8);
    }

    _renderWeaponButtons(ctx) {
        const startX = SCREEN.WIDTH - 100;
        const startY = 60;
        const spacing = 50;
        const weapons = ['1', '2', '3'];
        const colors = ['#ffcc00', '#ff6600', '#ff0000'];

        for (let i = 0; i < this.weaponButtons.length; i++) {
            const btn = this.weaponButtons[i];
            btn.x = startX;
            btn.y = startY + i * spacing;

            // Background
            ctx.beginPath();
            ctx.arc(btn.x, btn.y, 20, 0, Math.PI * 2);
            ctx.fillStyle = btn.pressed ? colors[i] : `rgba(50, 50, 50, 0.7)`;
            ctx.fill();
            ctx.strokeStyle = colors[i];
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = btn.pressed ? '#000' : '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(weapons[i], btn.x, btn.y);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let touchControlsInstance = null;

/**
 * Initialize touch controls
 */
export function initTouchControls(canvas) {
    touchControlsInstance = new TouchControls(canvas);
    return touchControlsInstance;
}

/**
 * Get touch controls instance
 */
export function getTouchControls() {
    return touchControlsInstance;
}

/**
 * Check if on touch device
 */
export function isTouchDevice() {
    return touchControlsInstance?.isTouchDevice ?? false;
}
