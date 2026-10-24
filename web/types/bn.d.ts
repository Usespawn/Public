/**
 * Minimal ambient declaration for bn.js.
 *
 * bn.js is a transitive dependency of @pump-fun/pump-sdk (no bundled types,
 * @types/bn.js not installed as a direct dev dependency). Only the surface
 * SpawnPad actually uses is declared here.
 */
declare module "bn.js" {
  export default class BN {
    constructor(
      value: number | string | number[] | Uint8Array | BN,
      base?: number | "hex" | "decimal" | "binary" | "octal" | "utc",
      endian?: "le" | "be"
    );
    toString(base?: number | "hex" | "decimal" | "binary" | "octal" | "utc"): string;
    toNumber(): number;
    toJSON(): string;
    isZero(): boolean;
    isNeg(): boolean;
    neg(): BN;
    abs(): BN;
    add(other: BN): BN;
    sub(other: BN): BN;
    mul(other: BN): BN;
    div(other: BN): BN;
    lt(other: BN): boolean;
    lte(other: BN): boolean;
    gt(other: BN): boolean;
    gte(other: BN): boolean;
    cmp(other: BN): number;
  }
}
