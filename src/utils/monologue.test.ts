import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMonologueLines,
  prepareTtsPrompt,
  estimateAudioDuration,
  getVoiceGender,
  DEFAULT_MONOLOGUE_TEXT,
} from './monologue';

test('parseMonologueLines parses lines and assigns emotional nuances', () => {
  const lines = parseMonologueLines(DEFAULT_MONOLOGUE_TEXT);
  assert.ok(lines.length > 15, 'Should have multiple monologue lines');
  assert.equal(lines[0].text, '..Запамятай раз і назавжди...');
  assert.equal(lines[0].emotion, 'intro');

  const ironyLine = lines.find((l) => l.text.includes('Ххе-хе...'));
  assert.ok(ironyLine, 'Should find irony line');
  assert.equal(ironyLine.emotion, 'irony');

  const turningLine = lines.find((l) => l.text.includes('привикне'));
  assert.ok(turningLine, 'Should find turning point line');
  assert.equal(turningLine.emotion, 'turning_point');
});

test('getVoiceGender identifies male and female prebuilt voices', () => {
  assert.equal(getVoiceGender('Charon'), 'male');
  assert.equal(getVoiceGender('Fenrir'), 'male');
  assert.equal(getVoiceGender('Puck'), 'male');
  assert.equal(getVoiceGender('Kore'), 'female');
  assert.equal(getVoiceGender('Zephyr'), 'female');
});

test('prepareTtsPrompt formats vocal bursts and adapts to male or female timbre', () => {
  const maleResult = prepareTtsPrompt(DEFAULT_MONOLOGUE_TEXT, 'Deep dramatic confession', 'male');
  assert.ok(maleResult.speechText.includes('<laugh>') || maleResult.speechText.includes('<breath>'));
  assert.ok(maleResult.stylePrompt.includes('Ukrainian'));
  assert.ok(maleResult.stylePrompt.includes('male timbre'));

  const femaleResult = prepareTtsPrompt(DEFAULT_MONOLOGUE_TEXT, 'Emotional confession', 'female');
  assert.ok(femaleResult.stylePrompt.includes('female timbre'));
  assert.ok(femaleResult.stylePrompt.includes('Ukrainian'));
});

test('estimateAudioDuration calculates a realistic reading time', () => {
  const duration = estimateAudioDuration(DEFAULT_MONOLOGUE_TEXT, 100);
  assert.ok(duration >= 25 && duration <= 80, `Duration ${duration}s should be within a reasonable dramatic monologue range`);
});
