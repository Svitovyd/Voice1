import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_PRESETS,
  clamp,
  sanitizeFeedback,
  calculateBalancedGains,
  floatTo16BitPCMBase64,
  base64PCMToFloat32,
} from './audioEffects';

test('EFFECT_PRESETS contains distinct audible dramatic presets', () => {
  assert.ok(EFFECT_PRESETS.length >= 4);
  const noir = EFFECT_PRESETS.find((p) => p.id === 'dramatic_noir');
  assert.ok(noir, 'Dramatic noir preset must exist');
  assert.equal(noir?.echoEnabled, true);
  assert.equal(noir?.reverbEnabled, true);
  assert.ok(noir!.echoMix >= 0.4, 'Echo mix should be prominently audible');
  assert.ok(noir!.reverbMix >= 0.5, 'Reverb mix should be prominently audible');
});

test('calculateBalancedGains attenuates dry gain and boosts wet levels', () => {
  const dryOnly = calculateBalancedGains(false, 0, false, 0);
  assert.equal(dryOnly.dryGain, 1.0);
  assert.equal(dryOnly.echoGain, 0);
  assert.equal(dryOnly.reverbGain, 0);

  const fullWet = calculateBalancedGains(true, 0.8, true, 0.8);
  assert.ok(fullWet.dryGain < 1.0, 'Dry gain should drop when wet effects are active');
  assert.ok(fullWet.echoGain > 1.0, 'Echo gain should be boosted');
  assert.ok(fullWet.reverbGain > 1.0, 'Reverb gain should be boosted');
});

test('PCM roundtrip converts Float32 to 16-bit PCM base64 and back accurately', () => {
  const original = new Float32Array([0, 0.5, -0.5, 0.99, -0.99]);
  const base64 = floatTo16BitPCMBase64(original);
  assert.ok(typeof base64 === 'string' && base64.length > 0);

  const reconstructed = base64PCMToFloat32(base64);
  assert.equal(reconstructed.length, original.length);
  for (let i = 0; i < original.length; i++) {
    assert.ok(
      Math.abs(reconstructed[i] - original[i]) < 0.001,
      `Sample ${i} mismatch: ${reconstructed[i]} vs ${original[i]}`
    );
  }
});
