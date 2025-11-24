import type { Plugin } from 'vite';

declare module '@ripple-ts/vite-plugin' {
	export function ripple(options?: RipplePluginOptions): Plugin[];

	export interface RipplePluginOptions {
		excludeRippleExternalModules?: boolean;
	}
}
