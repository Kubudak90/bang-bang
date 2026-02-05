// Audio - gelişmiş ses sistemi
// 3D positional audio, kategoriler, yeni silah/efekt sesleri

import { game } from './game.js';

let audioCtx = null;

// Volume kategorileri
const volumes = {
    master: 0.5,
    sfx: 0.7,
    music: 0.4,
    ambient: 0.3
};

// Ses öncelik sistemi - aynı anda çok fazla ses çalmasını engelle
const soundLimits = {
    footstep: { max: 2, current: 0 },
    gunshot: { max: 3, current: 0 },
    impact: { max: 5, current: 0 },
    explosion: { max: 2, current: 0 }
};

// Listener pozisyonu (oyuncu)
let listenerX = 0;
let listenerY = 0;
let listenerAngle = 0;

/**
 * Ses sistemini başlat
 */
export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/**
 * Ses context'i kontrol et
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
 * Listener pozisyonunu güncelle (her frame)
 */
export function updateListener(x, y, angle) {
    listenerX = x;
    listenerY = y;
    listenerAngle = angle;
}

/**
 * 3D positional audio hesapla
 * @returns {Object} { pan: -1 to 1, volume: 0 to 1 }
 */
function calculate3DAudio(soundX, soundY, maxDistance = 20) {
    const dx = soundX - listenerX;
    const dy = soundY - listenerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Mesafe bazlı volume (inverse square law benzeri)
    let volume = 1;
    if (distance > 1) {
        volume = Math.max(0, 1 - (distance / maxDistance));
        volume = volume * volume; // Daha hızlı düşüş
    }

    // Pan hesapla (listener açısına göre)
    const angleToSound = Math.atan2(dy, dx);
    const relativeAngle = angleToSound - listenerAngle;

    // -1 (sol) to 1 (sağ)
    const pan = Math.sin(relativeAngle);

    return { pan, volume, distance };
}

/**
 * StereoPanner ile ses çal
 */
function playWithPan(soundFn, pan, volumeMult = 1) {
    const ctx = ensureAudioContext();

    // StereoPanner oluştur
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = volumes.master * volumes.sfx * volumeMult;

    panner.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Ses fonksiyonunu çağır, panner'a bağla
    return { panner, masterGain };
}

/**
 * 3D pozisyonlu ses çal
 */
export function playSoundAt(name, x, y, maxDistance = 15) {
    const audio3d = calculate3DAudio(x, y, maxDistance);

    // Çok uzaksa çalma
    if (audio3d.volume < 0.05) return;

    playSound(name, audio3d.pan, audio3d.volume);
}

// ============================================
// SİLAH SESLERİ
// ============================================

function playPistolSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(finalVol * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);

    playNoise(0.05, 0.8 * vol, pan);
}

function playShotgunSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(finalVol * 0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    playNoise(0.15, 1.0 * vol, pan);
}

function playMachinegunSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(finalVol * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);

    playNoise(0.03, 0.6 * vol, pan);
}

function playSmgSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'square';
    osc.frequency.setValueAtTime(250, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(finalVol * 0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);

    playNoise(0.02, 0.5 * vol, pan);
}

function playRocketSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    // Derin woosh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(finalVol * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    playNoise(0.2, 0.7 * vol, pan);
}

function playPlasmaSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    // Elektronik zap
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(finalVol * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.1);
}

function playExplosionSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    // Derin boom
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(finalVol * 0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);

    // Loud noise
    playNoise(0.4, 1.0 * vol, pan);
}

// ============================================
// EFEKT SESLERİ
// ============================================

function playHurtSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(finalVol * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
}

function playPickupSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(finalVol * 0.3, ctx.currentTime);
    gain.gain.setValueAtTime(finalVol * 0.3, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
}

function playFootstepSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol * 0.5;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(60 + Math.random() * 20, ctx.currentTime);

    gain.gain.setValueAtTime(finalVol * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
}

function playKillSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(finalVol * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
}

function playDeathSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(finalVol * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
}

function playEnemyDeathSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(finalVol * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
}

function playReloadSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    // Click click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;

    osc.type = 'square';

    // İlk click
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(finalVol * 0.3, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.02);

    // İkinci click
    gain.gain.setValueAtTime(finalVol * 0.3, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.22);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
}

function playLevelUpSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';

    // Artan notalar
    const notes = [400, 500, 600, 800];
    let time = ctx.currentTime;

    for (const freq of notes) {
        osc.frequency.setValueAtTime(freq, time);
        time += 0.1;
    }

    gain.gain.setValueAtTime(finalVol * 0.4, ctx.currentTime);
    gain.gain.setValueAtTime(finalVol * 0.4, ctx.currentTime + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
}

function playBossAlertSound(pan = 0, vol = 1) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * vol;

    // Dramatic chord
    const oscs = [];
    const freqs = [100, 150, 200, 300];
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    for (const freq of freqs) {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        oscs.push(osc);
    }

    gain.gain.setValueAtTime(finalVol * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

    oscs.forEach(osc => {
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.0);
    });
}

/**
 * Noise burst
 */
function playNoise(duration, intensity, pan = 0) {
    const ctx = ensureAudioContext();
    const finalVol = volumes.master * volumes.sfx * intensity;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    noise.buffer = buffer;
    noise.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    panner.pan.value = pan;
    gain.gain.setValueAtTime(finalVol, ctx.currentTime);

    noise.start(ctx.currentTime);
}

// ============================================
// VOLUME KONTROL
// ============================================

export function setMasterVolume(vol) {
    volumes.master = Math.max(0, Math.min(1, vol));
}

export function setSfxVolume(vol) {
    volumes.sfx = Math.max(0, Math.min(1, vol));
}

export function setMusicVolume(vol) {
    volumes.music = Math.max(0, Math.min(1, vol));
}

export function setAmbientVolume(vol) {
    volumes.ambient = Math.max(0, Math.min(1, vol));
}

export function getVolumes() {
    return { ...volumes };
}

// ============================================
// ANA SES FONKSİYONU
// ============================================

export function playSound(name, pan = 0, vol = 1) {
    switch (name) {
        case 'pistol':
            playPistolSound(pan, vol);
            break;
        case 'shotgun':
            playShotgunSound(pan, vol);
            break;
        case 'machinegun':
            playMachinegunSound(pan, vol);
            break;
        case 'smg':
            playSmgSound(pan, vol);
            break;
        case 'rocket':
            playRocketSound(pan, vol);
            break;
        case 'plasma':
            playPlasmaSound(pan, vol);
            break;
        case 'explosion':
            playExplosionSound(pan, vol);
            break;
        case 'hurt':
            playHurtSound(pan, vol);
            break;
        case 'pickup':
            playPickupSound(pan, vol);
            break;
        case 'footstep':
            playFootstepSound(pan, vol);
            break;
        case 'kill':
            playKillSound(pan, vol);
            break;
        case 'death':
            playDeathSound(pan, vol);
            break;
        case 'enemyDeath':
            playEnemyDeathSound(pan, vol);
            break;
        case 'reload':
            playReloadSound(pan, vol);
            break;
        case 'levelup':
            playLevelUpSound(pan, vol);
            break;
        case 'bossAlert':
            playBossAlertSound(pan, vol);
            break;
        default:
            // Bilinmeyen ses - susturulmuş warning
            break;
    }
}
