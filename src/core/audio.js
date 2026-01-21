// Audio - basit ses efektleri (Web Audio API ile procedural)

let audioCtx = null;
let masterVolume = 0.3;

/**
 * Ses sistemini başlat
 */
export function initAudio() {
    // Kullanıcı etkileşimi gerektiğinden lazy init
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/**
 * Ses çal (lazy init ile)
 */
function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

/**
 * Silah sesi - Pistol
 */
export function playPistolSound() {
    const ctx = ensureAudioContext();

    // Kısa, keskin ses
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(masterVolume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);

    // Noise burst
    playNoise(0.05, 0.8);
}

/**
 * Silah sesi - Shotgun
 */
export function playShotgunSound() {
    const ctx = ensureAudioContext();

    // Derin boom
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(masterVolume * 0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    // Loud noise
    playNoise(0.15, 1.0);
}

/**
 * Silah sesi - Machinegun
 */
export function playMachinegunSound() {
    const ctx = ensureAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(masterVolume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);

    playNoise(0.03, 0.6);
}

/**
 * Düşman ölüm sesi
 */
export function playEnemyDeathSound() {
    const ctx = ensureAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(masterVolume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
}

/**
 * Hasar alma sesi
 */
export function playHurtSound() {
    const ctx = ensureAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(masterVolume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
}

/**
 * Loot toplama sesi
 */
export function playPickupSound() {
    const ctx = ensureAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    // Artan melodic ses
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(masterVolume * 0.3, ctx.currentTime);
    gain.gain.setValueAtTime(masterVolume * 0.3, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
}

/**
 * Adım sesi
 */
export function playFootstepSound() {
    const ctx = ensureAudioContext();

    // Soft thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(60 + Math.random() * 20, ctx.currentTime);

    gain.gain.setValueAtTime(masterVolume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
}

/**
 * Noise burst (silah efektleri için)
 */
function playNoise(duration, intensity) {
    const ctx = ensureAudioContext();

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();

    noise.buffer = buffer;
    noise.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(masterVolume * intensity, ctx.currentTime);

    noise.start(ctx.currentTime);
}

/**
 * Master volume ayarla
 */
export function setMasterVolume(vol) {
    masterVolume = Math.max(0, Math.min(1, vol));
}

/**
 * Genel ses çalma fonksiyonu (isimle)
 */
export function playSound(name) {
    switch (name) {
        case 'pistol':
            playPistolSound();
            break;
        case 'shotgun':
            playShotgunSound();
            break;
        case 'machinegun':
            playMachinegunSound();
            break;
        case 'hurt':
            playHurtSound();
            break;
        case 'pickup':
            playPickupSound();
            break;
        case 'footstep':
            playFootstepSound();
            break;
        case 'kill':
            playKillSound();
            break;
        case 'death':
            playDeathSound();
            break;
        case 'enemyDeath':
            playEnemyDeathSound();
            break;
        default:
            console.warn(`Unknown sound: ${name}`);
    }
}

/**
 * Kill sesi (başarılı öldürme)
 */
export function playKillSound() {
    const ctx = ensureAudioContext();

    // Victory ding
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(masterVolume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
}

/**
 * Ölüm sesi (oyuncu öldü)
 */
export function playDeathSound() {
    const ctx = ensureAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(masterVolume * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
}
