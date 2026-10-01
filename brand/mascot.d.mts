export const INK: string;
export const PAPER: string;
export const PAPER_BACK: string;
export const FADED: string;
export const STAMP: string;
export const MARKER: string;

export type Expression = "neutral" | "skeptic" | "happy" | "shock" | "angry" | "sleep" | "wink";
export type Pose = "down" | "point" | "wave" | "up" | "hold" | "hip";

export function body(opts?: { x?: number; y?: number; w?: number; h?: number; teeth?: number; depth?: number }): string;
export function printout(opts?: { x?: number; y?: number; w?: number; lines?: boolean; barcode?: boolean }): string;
export function face(expr?: Expression, opts?: { cx?: number; cy?: number }): string;
export function legs(opts?: { y?: number; color?: string }): string;
export function arms(pose?: Pose, color?: string): string;
export function stampProp(x?: number, y?: number): string;
export function magnifier(x?: number, y?: number): string;
export function character(opts?: {
  expr?: Expression;
  pose?: Pose;
  withLegs?: boolean;
  prop?: string;
  tilt?: number;
  lines?: boolean;
  shadow?: boolean;
  dark?: boolean;
}): string;
export function svg(inner: string, opts?: { w?: number | string; h?: number | string; viewBox?: string; bg?: string }): string;
export function symbol(opts?: { bg?: string; stroke?: boolean }): string;
export function shredder(opts?: { expr?: "grin" | "plain" }): string;
export function coupon(opts?: { text?: string; sub?: string }): string;
