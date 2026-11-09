const singleFrets=new Set([3,5,7,9,15,17,19,21]);
const single=[2.5],double=[1.5,3.5],none=[];

// Offsets from the highest string, in units of the distance between strings.
export const fretInlayRows=fret=>fret===12||fret===24?double:singleFrets.has(fret)?single:none;
