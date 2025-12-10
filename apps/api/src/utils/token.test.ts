import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./token.js";

describe("token utils", () => {
  it("generates random hex tokens", () => {
    const tokenA = generateToken(16);
    const tokenB = generateToken(16);
    expect(tokenA).toHaveLength(32);
    expect(tokenB).toHaveLength(32);
    expect(tokenA).not.toEqual(tokenB);
  });

  it("hashes tokens using sha256", () => {
    const token = "uptivalab";
    const hash = hashToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).toEqual(hashToken(token));
  });
});
