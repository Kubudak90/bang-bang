// Utils - yardımcı fonksiyonlar

const TWO_PI = Math.PI * 2;

/**
 * Açıyı 0 - 2π arasına normalize et
 */
export function normalizeAngle(angle) {
    while (angle < 0) angle += TWO_PI;
    while (angle >= TWO_PI) angle -= TWO_PI;
    return angle;
}

/**
 * Derece -> Radyan
 */
export function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Radyan -> Derece
 */
export function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

/**
 * Değeri min-max arasına sınırla
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * İki nokta arası mesafe
 */
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Lineer interpolasyon
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
