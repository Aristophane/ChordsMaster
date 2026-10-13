import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveChord} from '../dist/reorder.js';
const chords=['C','Dm','Em','F','G'].map(id=>({id,notes:[48,52,55]}));
const names=chords=>chords.map(chord=>chord.id);
test('Move forward and backward without losing any chord or changing its notes',()=>{
  assert.deepEqual(names(moveChord(chords,'C','F')),['Dm','Em','F','C','G']);
  const reordered=moveChord(chords,'G','Dm');
  assert.deepEqual(names(reordered),['C','G','Dm','Em','F']);
  assert.equal(reordered[1],chords[4]);
  assert.deepEqual(names(chords),['C','Dm','Em','F','G']);
});
test('Moves to both ends are reversible; unknown and identical slots do nothing',()=>{
  assert.deepEqual(names(moveChord(chords,'G','C')),['G','C','Dm','Em','F']);
  const moved=moveChord(chords,'C','G');
  assert.deepEqual(names(moveChord(moved,'C','Dm')),names(chords));
  assert.equal(moveChord(chords,'missing','C'),chords);
  assert.equal(moveChord(chords,'C','missing'),chords);
  assert.equal(moveChord(chords,'C','C'),chords);
  assert.deepEqual(moveChord([],'C','G'),[]);
});
