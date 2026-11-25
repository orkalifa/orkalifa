export type Rgba = { width: number; height: number; data: Uint8Array };
export const SOURCE: string;
export const PARCHMENT: readonly [number, number, number];
export const FILL: number;
export const FOREGROUND_RADIUS: number;
export const MASKABLE_RADIUS: number;
export function manifestIcons(base: string): { src: string; sizes: string; type: string; purpose: string }[];
export function readPng(file: string): Promise<Rgba>;
export function makeIcons(outRoot?: string): Promise<string[]>;
