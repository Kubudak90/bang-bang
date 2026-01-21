# CLAUDE.md - 2D Raycasting FPS

## Proje Özeti

2D motor üzerinde birinci şahıs hissi veren, roguelite elementleri olan retro FPS.
HTML5 Canvas + vanilla JavaScript. Framework yok, bağımlılık yok, bahane yok.

---

## Temel Prensipler

### Vibecoding Kuralları
1. **Önce hissiyat** - Oynanış "doğru hissediyorsa" matematiksel mükemmellik bekleyebilir
2. **Küçük milestone'lar** - Her commit oynanabilir olmalı
3. **Ego yok** - "Sonra refactor ederim" demek yasak
4. **Basitlik** - İlk versiyonda gereksiz özellik yok

### Kod Felsefesi
- Tek sorumluluk prensibi: her modül bir iş yapar
- Global state minimum: sadece `game.js` tutar
- Magic number yasak: `config.js` kullan
- Yorum yerine açık isim: `calculateWallDistance()` > `calc()` + yorum

---

## Mimari Kurallar

### Dosya Yapısı
```
/src
 ├─ index.html
 ├─ main.js              # init + game loop
 ├─ core/                # state, config, utils
 ├─ input/               # keyboard, mouse
 ├─ player/              # hareket, silah, perk
 ├─ world/               # map, loot, entity
 ├─ enemies/             # AI, tipler
 ├─ engine/              # raycaster, renderer, camera
 ├─ ui/                  # HUD, minimap, efektler
 └─ assets/              # texture, sound, font
```

### Modül İletişimi
- **Input → Player**: doğrudan çağrı
- **Player ↔ World**: collision check için world metodları
- **World → Enemies**: her frame update
- **Engine ← Hepsi**: sadece okur, hiçbir şeyi değiştirmez
- **UI ← Game State**: read-only binding

### Yasaklar
- ❌ `eval()` veya `Function()` constructor
- ❌ Circular dependency
- ❌ DOM manipulation render loop içinde
- ❌ `var` kullanımı (`const`/`let` only)
- ❌ Anonymous export (`export default` yerine named export)

---

## Teknik Spesifikasyonlar

### Canvas
- Çözünürlük: 640x400 (4:2.5, retro his)
- Scaling: CSS ile tam ekran, nearest-neighbor
- Target FPS: 60 (requestAnimationFrame)
- Delta time zorunlu: frame-bağımsız fizik

### Raycasting
- FOV: 60 derece (değiştirilebilir)
- Ray sayısı: canvas genişliği kadar (640)
- Duvar yüksekliği: mesafeye ters orantılı
- Texture mapping: vertical slice

### Collision
- Grid-based: tile merkezli kontrol
- Oyuncu radius: 0.25 birim
- Sliding collision: duvara çarpınca kayma

### Koordinat Sistemi
- Map: 2D array, `map[y][x]`
- Pozisyon: float (0.0 - mapSize)
- Açı: radyan, 0 = sağ, π/2 = yukarı

---

## Oyun Tasarım Kararları

### Çekirdek Döngü
```
İlerle → Düşman gör → Vur → Loot al → Güçlen → Tekrarla
```

### Hareket
- WASD: ileri/geri/strafe
- Mouse X: dönme
- Yukarı-aşağı bakış: YOK (bilinçli karar, tempo için)

### Silahlar (v1)
1. Pistol - sınırsız mermi, yavaş
2. Shotgun - geniş spread, yakın mesafe
3. Assault - hızlı, orta hasar

### Düşman Tipleri (v1)
1. Grunt - yürür, yakından vurur
2. Shooter - durur, ateş eder
3. Charger - koşar, çarpar

### Progression
- Run içi: silah upgrade, geçici buff
- Kalıcı: yok (v1'de)

---

## Milestone'lar

### M1 - "Yürüyorum" ✓ (hedef: bugün)
- [ ] Boş canvas
- [ ] Player pozisyon + açı
- [ ] WASD hareket
- [ ] Mouse dönme
- [ ] Basit grid map
- [ ] Collision

### M2 - "Görüyorum"
- [ ] Raycasting implementasyonu
- [ ] Duvar render
- [ ] Mesafe shading
- [ ] Zemin/tavan

### M3 - "Vuruyorum"
- [ ] Silah sistemi
- [ ] Hit detection
- [ ] Düşman spawn
- [ ] Düşman ölümü

### M4 - "Oyun oluyor"
- [ ] Procedural map
- [ ] Loot sistemi
- [ ] HUD
- [ ] Ses efektleri

---

## Debug Araçları

### Minimap (her zaman aktif - dev mode)
- Oyuncu: yeşil nokta
- Duvarlar: beyaz
- Düşmanlar: kırmızı
- Işınlar: sarı çizgiler (toggle)

### Konsol Komutları
```javascript
game.debug.showRays = true
game.debug.noclip = true
game.debug.godmode = true
game.debug.spawnEnemy('grunt', x, y)
```

### Performance
- FPS counter sol üst
- Draw call sayısı (hedef: < 1000)

---

## Kodlama Standartları

### Naming
- Dosya: `camelCase.js`
- Class: `PascalCase`
- Fonksiyon/değişken: `camelCase`
- Sabit: `SCREAMING_SNAKE`
- Private: `_underscore` prefix

### Fonksiyon Boyutu
- Max 30 satır (zorla bölünecek değilse)
- Bir fonksiyon bir iş

### Import/Export
```javascript
// ✓ Doğru
export function castRay() {}
export const FOV = Math.PI / 3;

// ✗ Yanlış
export default class Raycaster {}
```

### Yorum Kuralları
- Kod ne yapıyor: yazma (isim açık olsun)
- Kod neden böyle: yaz
- TODO: tarih ve context ile

```javascript
// ✓
// Fish-eye düzeltmesi olmadan duvarlar kavisli görünür
const correctedDist = rawDist * Math.cos(rayAngle - player.angle);

// ✗
// Mesafeyi hesapla
const dist = getDist();
```

---

## Test Stratejisi

### Manuel Test (v1)
- Her milestone sonunda 5 dakika oyna
- "Bu eğlenceli mi?" sorusu

### Otomatik (gelecekte)
- Raycasting: bilinen map + pozisyon = beklenen çıktı
- Collision: köşe vakaları
- Math utils: unit test

---

## Bilinen Sınırlamalar (v1)

- Texture yok, solid renkler
- Ses yok
- Kaydetme yok
- Tek seviye tipi
- Sadece masaüstü (touch yok)

Bunlar bilinçli. Önce bitir, sonra süsle.

---

## Kaynaklar

- [Lode's Raycasting Tutorial](https://lodev.org/cgtutor/raycasting.html) - Kutsal metin
- [Permadi Raycasting](https://permadi.com/1996/05/ray-casting-tutorial-table-of-contents/) - OG döküman

---

## Son Söz

Bu oyun bitecek. Yarım kalmayacak.
Her gün 30 dakika > haftada bir 5 saat.
Mükemmel düşmanı iyinin.

Hadi başlayalım.
