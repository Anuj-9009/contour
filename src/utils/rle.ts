/**
 * Run-Length Encoding (RLE) utility for high-performance client-side binary mask compression.
 * Encodes consecutive identical pixels as count runs to save memory during 30fps video decoding.
 */

/**
 * Encodes a binary Uint8Array mask (containing only 0s and 1s) into RLE runs.
 * We record the alternating counts of 0s and 1s, starting with the count of leading 0s.
 */
export function encodeRLE(mask: Uint8Array): Uint32Array {
  const runs: number[] = [];
  let currentVal = 0;
  let count = 0;

  for (let i = 0; i < mask.length; i++) {
    const val = mask[i] > 0 ? 1 : 0; // threshold (input is already binarized to 0/1)
    if (val === currentVal) {
      count++;
    } else {
      runs.push(count);
      currentVal = val;
      count = 1;
    }
  }
  runs.push(count);

  return new Uint32Array(runs);
}

/**
 * Decodes RLE runs back into a binary Uint8Array of the specified original length.
 */
export function decodeRLE(runs: Uint32Array, length: number): Uint8Array {
  const mask = new Uint8Array(length);
  let index = 0;
  let currentVal = 0;

  for (let i = 0; i < runs.length; i++) {
    const count = runs[i];
    if (currentVal === 1) {
      mask.fill(1, index, Math.min(index + count, length));
    }
    index += count;
    currentVal = 1 - currentVal;
  }

  return mask;
}
