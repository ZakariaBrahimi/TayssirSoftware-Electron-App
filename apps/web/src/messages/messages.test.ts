import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import en from "./en.json";
import fr from "./fr.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  const reference = keys(en).sort();
  it.each([
    ["fr", fr],
    ["ar", ar],
  ])("%s has exactly the same keys as en", (_, messages) => {
    expect(keys(messages).sort()).toEqual(reference);
  });
});
