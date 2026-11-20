import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyScoreSoundCue } from './audioService';

test('classifyScoreSoundCue selects applause cues for gains and buzzer for penalties', () => {
  assert.equal(classifyScoreSoundCue(10, 'CORRECT', false), 'CORRECT_APPLAUSE');
  assert.equal(classifyScoreSoundCue(20, 'BONUS', false), 'BONUS_APPLAUSE');
  assert.equal(classifyScoreSoundCue(10, 'CORRECT', true), 'LEADER_FANFARE');
  assert.equal(classifyScoreSoundCue(-5, 'WRONG', false), 'BUZZER');
  assert.equal(classifyScoreSoundCue(-10, 'UNDO', false), 'UNDO');
  assert.equal(classifyScoreSoundCue(0, 'RESET', false), 'NONE');
});
