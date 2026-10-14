import { describe, expect, it } from "vitest";
import { rasterJob, toBase64, toMonochrome } from "./escpos";

/** RGBA pixels from rows of "#" (black) and "." (white). */
function pixels(rows: string[]) {
  const width = rows[0].length;
  const data: number[] = [];
  for (const row of rows) {
    for (const c of row) data.push(...(c === "#" ? [0, 0, 0, 255] : [255, 255, 255, 255]));
  }
  return { width, height: rows.length, data };
}

describe("escpos", () => {
  it("packs dark pixels into bits, rows padded to bytes", () => {
    const mono = toMonochrome(pixels(["#........#", "##........"]));
    expect(mono.bytesPerRow).toBe(2);
    expect(Array.from(mono.bits)).toEqual([0b10000000, 0b01000000, 0b11000000, 0]);
    // Transparent counts as white paper.
    expect(Array.from(toMonochrome({ width: 1, height: 1, data: [0, 0, 0, 0] }).bits)).toEqual([0]);
  });

  it("builds a raster job in bands of 255 rows with feed and cut", () => {
    const tall = pixels(Array.from({ length: 300 }, () => "#"));
    const job = rasterJob(tall);
    expect(Array.from(job.subarray(0, 2))).toEqual([0x1b, 0x40]);
    // First band header: 1 byte per row, 255 rows.
    expect(Array.from(job.subarray(2, 10))).toEqual([0x1d, 0x76, 0x30, 0, 1, 0, 255, 0]);
    // Second band: the remaining 45 rows.
    const second = 10 + 255;
    expect(Array.from(job.subarray(second, second + 8))).toEqual([
      0x1d, 0x76, 0x30, 0, 1, 0, 45, 0,
    ]);
    expect(Array.from(job.subarray(-7))).toEqual([0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0]);
    expect(rasterJob(tall, { cut: false }).length).toBe(job.length - 4);
    expect(toBase64(Uint8Array.from([0x1b, 0x40]))).toBe("G0A=");
  });
});
