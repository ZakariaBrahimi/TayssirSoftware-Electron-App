/*
 * ESC/POS for thermal receipt printers. Receipts are sent as one raster
 * image (GS v 0), so Arabic text, logos and QR codes print exactly as on
 * screen, on any printer, without code pages.
 */

/** Printable width in dots: 58 mm paper → 384, 80 mm → 576 (203 dpi). */
export const PRINTER_DOTS = { "58": 384, "80": 576 } as const;

type Pixels = { width: number; height: number; data: Uint8ClampedArray | number[] };

/** 1 bit per pixel, rows padded to whole bytes; dark pixels print. */
export function toMonochrome({ width, height, data }: Pixels, threshold = 170) {
  const bytesPerRow = Math.ceil(width / 8);
  const bits = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3] / 255;
      // Transparent pixels are paper (white).
      const luminance =
        (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * alpha + 255 * (1 - alpha);
      if (luminance < threshold) bits[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { bytesPerRow, height, bits };
}

/** A full print job: reset, the image in bands, feed and cut. */
export function rasterJob(pixels: Pixels, options: { cut?: boolean } = {}) {
  const { bytesPerRow, height, bits } = toMonochrome(pixels);
  const parts: number[][] = [[0x1b, 0x40]]; // ESC @: reset
  // Bands of at most 255 rows: some printers have small buffers.
  for (let top = 0; top < height; top += 255) {
    const rows = Math.min(255, height - top);
    parts.push([
      0x1d,
      0x76,
      0x30,
      0x00, // GS v 0, normal size
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      rows & 0xff,
      (rows >> 8) & 0xff,
    ]);
    parts.push(Array.from(bits.subarray(top * bytesPerRow, (top + rows) * bytesPerRow)));
  }
  parts.push([0x1b, 0x64, 0x04]); // ESC d 4: feed 4 lines
  if (options.cut !== false) parts.push([0x1d, 0x56, 0x42, 0x00]); // GS V B: partial cut
  return Uint8Array.from(parts.flat());
}

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
