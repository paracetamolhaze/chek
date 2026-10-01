export type Stamp = "UNVERIFIED" | "VOID" | "PROOF PENDING" | "NO RECEIPT";

export const STAMPS: Stamp[];
export const DEFAULT_STAMP: "UNVERIFIED";
export const LIMITS: { claimMin: number; claimMax: number; nameMax: number };
export const STAMP_COPY: Record<Stamp, { proof: string; mood: { expr: "skeptic" | "angry"; pose: "point" | "hip"; prop?: "magnifier" | "stamp" } }>;
export const DISCLAIMER: string;

export type ClaimInput = { claim?: unknown; name?: unknown; stamp?: unknown };
export type ClaimCheck = {
  ok: boolean;
  /** normalized claim: NFC, whitespace collapsed, unprintable characters (emoji…) dropped */
  claim: string;
  name: string;
  /** a valid stamp; the default when the input was invalid (then ok is false) */
  stamp: Stamp;
  /** short human reasons; empty when ok */
  problems: string[];
  /** the same problems grouped by field */
  by: { claim: string[]; name: string[]; stamp: string[] };
  /** how many characters were dropped because the receipt can't print them */
  dropped: number;
};

export function normalize(s: unknown): { text: string; dropped: number };
export function stampOf(s: unknown): string;
export function stampSlug(stamp: unknown): string;
export function checkClaim(input?: ClaimInput): ClaimCheck;
export function claimCode(claim: unknown): string;
export function claimQuery(r: { claim?: string; name?: string; stamp?: string }, opts?: { short?: boolean }): string;
export function printDate(d?: Date | string | number): string;
