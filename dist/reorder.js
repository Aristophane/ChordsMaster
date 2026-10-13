// Move to the target slot while preserving every other chord's relative order.
export function moveChord(chords, sourceId, targetId) {
  const from=chords.findIndex(chord=>chord.id===sourceId);
  const to=chords.findIndex(chord=>chord.id===targetId);
  if(from<0||to<0||from===to)return chords;
  const reordered=[...chords];
  const [chord]=reordered.splice(from,1);
  reordered.splice(to,0,chord);
  return reordered;
}
