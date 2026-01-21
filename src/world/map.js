// Map - 2D grid tabanlı dünya

/**
 * Test haritası oluştur
 * 0 = boşluk
 * 1 = brick (tuğla)
 * 2 = stone (taş)
 * 3 = metal
 * 4 = tech (sci-fi)
 */
export function createMap() {
    // Farklı texture'larla test haritası (16x16)
    const data = [
        [1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
        [1,0,0,3,3,3,0,0,0,0,4,4,4,0,0,2],
        [1,0,0,3,0,0,0,0,0,0,0,0,4,0,0,2],
        [1,0,0,3,0,0,0,0,0,0,0,0,4,0,0,2],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
        [1,0,0,0,0,0,0,4,4,0,0,0,0,0,0,2],
        [1,0,0,0,0,0,0,4,4,0,0,0,0,0,0,2],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
        [1,0,0,2,0,0,0,0,0,0,0,0,3,0,0,2],
        [1,0,0,2,0,0,0,0,0,0,0,0,3,0,0,2],
        [1,0,0,2,2,2,0,0,0,0,3,3,3,0,0,2],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
        [1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2]
    ];
    
    return {
        data,
        width: data[0].length,
        height: data.length,
        
        /**
         * Verilen koordinatta duvar var mı?
         */
        isWall(x, y) {
            // Sınır kontrolü
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return true; // Harita dışı = duvar
            }
            return this.data[y][x] !== 0;
        },
        
        /**
         * Verilen koordinattaki tile değeri
         */
        getTile(x, y) {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return 1;
            }
            return this.data[y][x];
        }
    };
}
