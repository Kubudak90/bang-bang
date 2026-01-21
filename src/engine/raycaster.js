// Raycaster - DDA algoritması ile sahte 3D

import { SCREEN, RAYCASTER } from '../core/config.js';

/**
 * Tüm ışınları at ve duvar bilgilerini döndür
 * Her piksel sütunu için bir ışın
 */
export function castRays(player, map) {
    const rays = [];
    const numRays = SCREEN.WIDTH;
    
    for (let i = 0; i < numRays; i++) {
        // Ekranın solundan sağına, FOV içinde açı hesapla
        const rayAngle = player.angle - RAYCASTER.FOV / 2 + (i / numRays) * RAYCASTER.FOV;
        const ray = castSingleRay(player.x, player.y, rayAngle, map);
        
        // Fish-eye düzeltmesi
        // Işın açısı ile bakış açısı arasındaki farkın kosinüsü
        const angleDiff = rayAngle - player.angle;
        ray.correctedDistance = ray.distance * Math.cos(angleDiff);
        
        rays.push(ray);
    }
    
    return rays;
}

/**
 * Tek bir ışın at - DDA algoritması
 * Digital Differential Analyzer: grid boyunca adım adım ilerle
 */
function castSingleRay(startX, startY, angle, map) {
    // Işın yönü
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    
    // Hangi grid hücresindeyiz
    let mapX = Math.floor(startX);
    let mapY = Math.floor(startY);
    
    // Bir grid hücresi geçmek için gereken mesafe
    // |1 / dirX| ve |1 / dirY|
    const deltaDistX = Math.abs(1 / dirX);
    const deltaDistY = Math.abs(1 / dirY);
    
    // Işın hangi yönde ilerliyor
    let stepX, stepY;
    let sideDistX, sideDistY;
    
    // X yönü
    if (dirX < 0) {
        stepX = -1;
        sideDistX = (startX - mapX) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (mapX + 1 - startX) * deltaDistX;
    }
    
    // Y yönü
    if (dirY < 0) {
        stepY = -1;
        sideDistY = (startY - mapY) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (mapY + 1 - startY) * deltaDistY;
    }
    
    // DDA döngüsü
    let hit = false;
    let side = 0; // 0 = dikey duvar (N/S), 1 = yatay duvar (E/W)
    let distance = 0;
    
    while (!hit && distance < RAYCASTER.MAX_DEPTH) {
        // Bir sonraki grid çizgisine atla
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }
        
        // Duvar kontrolü
        if (map.isWall(mapX, mapY)) {
            hit = true;
        }
    }
    
    // Mesafe hesabı
    // side 0: X ekseninde kesişim
    // side 1: Y ekseninde kesişim
    if (side === 0) {
        distance = (mapX - startX + (1 - stepX) / 2) / dirX;
    } else {
        distance = (mapY - startY + (1 - stepY) / 2) / dirY;
    }
    
    // Tam kesişim noktası (texture mapping için)
    let wallX;
    if (side === 0) {
        wallX = startY + distance * dirY;
    } else {
        wallX = startX + distance * dirX;
    }
    wallX -= Math.floor(wallX); // 0-1 arası normalize
    
    // Duvar yönünü belirle (renk için)
    let wallSide;
    if (side === 0) {
        wallSide = stepX > 0 ? 'west' : 'east';
    } else {
        wallSide = stepY > 0 ? 'north' : 'south';
    }
    
    return {
        distance,
        correctedDistance: distance, // fish-eye düzeltmesi sonra uygulanacak
        hit,
        side,
        wallSide,
        wallX,
        mapX,
        mapY,
        angle
    };
}
