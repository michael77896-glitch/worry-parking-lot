// Generates the box-opening sound effects as small mono WAV files in assets/sounds/.
// The sounds are synthesized (soft bell and thump tones), so there is nothing to license and the
// app stays small. Run it with:  node scripts/make-sounds.js
//
// Tone choices follow the app's calm style: soft attacks, no harsh highs, no alarms. Each rarity's
// reveal adds a note: Common is one soft bell, Rare two, Epic three, Legendary a shimmering rise.
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

function silence(seconds) {
  return new Float32Array(Math.round(seconds * SAMPLE_RATE));
}

/** Adds `source` into `target`, starting `at` seconds in. */
function mixInto(target, source, at = 0, gain = 1) {
  const start = Math.round(at * SAMPLE_RATE);
  for (let i = 0; i < source.length && start + i < target.length; i++) target[start + i] += source[i] * gain;
}

/** A soft bell: a few harmonics that fade out at different speeds. */
function bell(freq, seconds, { decay = 3.2, vibrato = 0 } = {}) {
  const out = silence(seconds);
  const partials = [
    [1, 1.0],
    [2.0, 0.4],
    [2.76, 0.22],
    [5.4, 0.08],
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.006);
    let v = 0;
    for (const [mult, amp] of partials) {
      const wobble = vibrato ? 1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t) : 1;
      v += amp * Math.sin(2 * Math.PI * freq * mult * wobble * t) * Math.exp(-t * decay * (0.6 + mult * 0.5));
    }
    out[i] = v * attack;
  }
  return out;
}

/** A short, soft click for each card that passes the marker. */
function tick() {
  const out = silence(0.05);
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = (Math.sin(2 * Math.PI * 1850 * t) * 0.7 + Math.sin(2 * Math.PI * 980 * t) * 0.5) * Math.exp(-t * 95) * Math.min(1, t / 0.001);
  }
  return out;
}

/** A low thump with a quick, soft rush of air: the box popping open. */
function open() {
  const out = silence(0.55);
  let noiseState = 0;
  let seed = 12345;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const thumpFreq = 60 + 90 * Math.exp(-t * 14);
    const thump = Math.sin(2 * Math.PI * thumpFreq * t) * Math.exp(-t * 9) * 0.95;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const white = seed / 4294967296 * 2 - 1;
    noiseState += 0.18 * (white - noiseState); // low-passed noise
    const air = noiseState * Math.exp(-t * 11) * 0.55 * Math.min(1, t / 0.01);
    const rise = Math.sin(2 * Math.PI * (380 + 520 * t) * t) * Math.exp(-t * 6) * 0.16 * Math.min(1, t / 0.04);
    out[i] = thump + air + rise;
  }
  return out;
}

function arpeggio(notes, step, tail, opts) {
  const total = notes.length * step + tail;
  const out = silence(total);
  notes.forEach((f, i) => mixInto(out, bell(f, total - i * step, opts), i * step, 0.8));
  return out;
}

/** Scales to a gentle peak and writes 16-bit mono PCM. */
function save(name, samples, peak = 0.55) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const scale = max > 0 ? peak / max : 1;
  const fade = Math.round(0.012 * SAMPLE_RATE);
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => {
    const edge = Math.min(1, (samples.length - i) / fade); // no click at the end
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * scale * edge * 32767))), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name}.wav  ${(samples.length / SAMPLE_RATE).toFixed(2)}s  ${((header.length + data.length) / 1024).toFixed(0)} KB`);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5;

save('tick', tick(), 0.5);
save('open', open(), 0.7);
save('reveal-common', bell(C5, 0.9), 0.5);
save('reveal-rare', arpeggio([C5, E5], 0.13, 0.8, {}), 0.55);
save('reveal-epic', arpeggio([C5, E5, G5, C6], 0.11, 1.0, {}), 0.6);
save('reveal-legendary', arpeggio([C5, E5, G5, C6, E6], 0.1, 1.7, { decay: 2.2, vibrato: 0.004 }), 0.65);
