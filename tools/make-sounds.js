// Writes the game's sound effects and background music as .wav files into public/sounds/
// Run with:  node tools/make-sounds.js
// The page plays them with <audio> elements (see public/js/sound.js).
// Outside the slides: the sounds are made with simple maths (sine/square waves + noise) and saved as
// 16-bit PCM WAV files using Node's Buffer, so no sound files need to be downloaded.

const fs = require("fs");
const path = require("path");
const OUT_DIR = path.join(__dirname, "..", "public", "sounds");
fs.mkdirSync(OUT_DIR, { recursive: true });

const RATE = 22050;                                        // samples per second

// ---------- Building blocks ----------
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);       // MIDI note number -> frequency
const waves = {
    sine: (p) => Math.sin(2 * Math.PI * p),
    square: (p) => (p % 1 < 0.5 ? 1 : -1),
    triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
    noise: () => Math.random() * 2 - 1
};

// One sound: frequency can change over time (from -> to); volume fades with a quick attack and a decay
const tone = function ({ from, to = from, dur, wave = "square", vol = 0.4, attack = 0.005, release = 0.6 }) {
    const n = Math.floor(dur * RATE), out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / n;
        const f = from * Math.pow(to / from, t);               // smooth slide between the two pitches
        phase += f / RATE;
        const env = Math.min(1, (i / RATE) / attack) * (t < 1 - release ? 1 : (1 - t) / release);
        out[i] = waves[wave](phase) * vol * env;
    }
    return out;
};

const join = (...parts) => {                                   // play parts one after another
    const total = parts.reduce((s, p) => s + p.length, 0), out = new Float32Array(total);
    let at = 0;
    parts.forEach((p) => { out.set(p, at); at += p.length; });
    return out;
};
const mix = (...parts) => {                                    // play parts at the same time
    const out = new Float32Array(Math.max(...parts.map((p) => p.length)));
    parts.forEach((p) => p.forEach((v, i) => { out[i] += v; }));
    return out;
};
const silence = (dur) => new Float32Array(Math.floor(dur * RATE));
const notes = (list, dur, opts) => join(...list.map((n) => (n === null ? silence(dur) : tone(Object.assign({ from: NOTE(n), dur }, opts)))));

// ---------- WAV file (16-bit mono PCM) ----------
const writeWav = function (name, samples) {
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
    const header = Buffer.alloc(44);
    header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
    header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write("data", 36); header.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(OUT_DIR, name + ".wav"), Buffer.concat([header, data]));
    console.log("wrote", name + ".wav", (samples.length / RATE).toFixed(2) + " s");
};

// ---------- The sounds ----------
const SOUNDS = {
    pickup: () => tone({ from: 520, to: 980, dur: 0.09, vol: 0.3 }),
    drop: () => tone({ from: 700, to: 330, dur: 0.1, vol: 0.3 }),
    chop: () => mix(tone({ from: 1800, dur: 0.05, wave: "noise", vol: 0.35, release: 0.9 }), tone({ from: 220, to: 120, dur: 0.06, vol: 0.3 })),
    serve: () => notes([72, 76, 79, 84], 0.08, { vol: 0.3, release: 0.4 }),
    heart: () => join(tone({ from: 440, to: 300, dur: 0.16, vol: 0.35 }), tone({ from: 300, to: 160, dur: 0.28, vol: 0.35 })),
    throw: () => tone({ from: 900, to: 300, dur: 0.18, wave: "noise", vol: 0.25 }),
    bonk: () => mix(tone({ from: 160, to: 60, dur: 0.25, wave: "sine", vol: 0.7 }), tone({ from: 1200, dur: 0.08, wave: "noise", vol: 0.35 })),
    burnt: () => mix(tone({ from: 110, dur: 0.5, vol: 0.25 }), tone({ from: 116, dur: 0.5, vol: 0.25 })),
    cheat: () => notes([72, 79, 84, 88, 91, 96], 0.06, { wave: "triangle", vol: 0.35, release: 0.3 }),
    sprint: () => tone({ from: 300, to: 1200, dur: 0.22, wave: "triangle", vol: 0.35 }),
    boost: () => notes([79, 84], 0.07, { wave: "triangle", vol: 0.3 }),
    count: () => tone({ from: NOTE(69), dur: 0.15, vol: 0.3 }),
    go: () => tone({ from: NOTE(81), dur: 0.4, vol: 0.3, release: 0.5 }),
    overtime: () => join(...[0, 1, 2].map(() => join(tone({ from: 880, dur: 0.14, vol: 0.3 }), tone({ from: 660, dur: 0.14, vol: 0.3 })))),
    ko: () => join(tone({ from: 600, to: 80, dur: 0.6, vol: 0.35 }), mix(tone({ from: 90, to: 50, dur: 0.3, wave: "sine", vol: 0.6 }), tone({ from: 800, dur: 0.15, wave: "noise", vol: 0.3 }))),
    win: () => notes([72, 76, 79, 84, null, 79, 84], 0.13, { vol: 0.3, release: 0.3 }),
    lose: () => notes([72, 67, 64, 60], 0.22, { wave: "triangle", vol: 0.35, release: 0.5 })
};

// Background music: a cheerful 8-bar loop (bass + melody) at 140 beats per minute
const music = function () {
    const beat = 60 / 140 / 2;                                 // eighth notes
    const bassLine = [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50];
    const melody = [76, null, 79, 76, 72, null, 74, 76, 77, null, 76, 74, 72, 74, 71, null,
        76, null, 79, 81, 79, 76, 74, 72, 74, null, 72, 71, 72, null, null, null];
    const bass = join(...[0, 1].map(() => notes(bassLine, beat, { wave: "triangle", vol: 0.32, release: 0.3 })));
    const lead = notes(melody, beat, { wave: "square", vol: 0.12, release: 0.5 });
    const hats = join(...Array.from({ length: 32 }, (_, i) => join(tone({ from: 5000, dur: 0.03, wave: "noise", vol: i % 2 ? 0.05 : 0.09 }), silence(beat - 0.03))));
    const once = mix(bass, lead, hats);
    return join(once, once);                                   // about 14 s, loops cleanly
};

Object.keys(SOUNDS).forEach((name) => writeWav(name, SOUNDS[name]()));
writeWav("music", music());
