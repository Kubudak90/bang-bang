// Minimap - debug için kuşbakışı görünüm

import { COLORS, DEBUG } from '../core/config.js';
import { game } from '../core/game.js';
import { getLoots } from '../world/loot.js';

/**
 * Minimap render et
 */
export function renderMinimap(ctx, map, player, rays) {
    const scale = DEBUG.MINIMAP_SCALE;
    const padding = DEBUG.MINIMAP_PADDING;
    const mapWidth = map.width * scale;
    const mapHeight = map.height * scale;

    // Arka plan
    ctx.fillStyle = COLORS.MINIMAP_BG;
    ctx.fillRect(padding, padding, mapWidth, mapHeight);

    // Duvarlar
    ctx.fillStyle = COLORS.MINIMAP_WALL;
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            if (map.isWall(x, y)) {
                ctx.fillRect(
                    padding + x * scale,
                    padding + y * scale,
                    scale - 1,
                    scale - 1
                );
            }
        }
    }

    // Işınlar (opsiyonel)
    if (rays && rays.length > 0) {
        ctx.strokeStyle = COLORS.MINIMAP_RAY;
        ctx.lineWidth = 1;

        // Her 10. ışını çiz (performans için)
        for (let i = 0; i < rays.length; i += 10) {
            const ray = rays[i];
            if (!ray.hit) continue;

            const startX = padding + player.x * scale;
            const startY = padding + player.y * scale;
            const endX = padding + (player.x + Math.cos(ray.angle) * ray.distance) * scale;
            const endY = padding + (player.y + Math.sin(ray.angle) * ray.distance) * scale;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    // Oyuncu
    const playerX = padding + player.x * scale;
    const playerY = padding + player.y * scale;

    // Oyuncu noktası
    ctx.fillStyle = COLORS.MINIMAP_PLAYER;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bakış yönü çizgisi
    ctx.strokeStyle = COLORS.MINIMAP_PLAYER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playerX, playerY);
    ctx.lineTo(
        playerX + Math.cos(player.angle) * 15,
        playerY + Math.sin(player.angle) * 15
    );
    ctx.stroke();

    // Düşmanlar (kırmızı noktalar)
    const enemies = game.enemies || [];
    for (const enemy of enemies) {
        if (enemy.isDead) continue;

        const ex = padding + enemy.x * scale;
        const ey = padding + enemy.y * scale;

        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Loot'lar (sarı noktalar)
    const loots = getLoots() || [];
    for (const loot of loots) {
        if (loot.collected) continue;

        const lx = padding + loot.x * scale;
        const ly = padding + loot.y * scale;

        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}
