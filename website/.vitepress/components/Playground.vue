<script setup lang="ts">
import LiveCodes from 'livecodes/vue'
import type { EmbedOptions, Playground } from 'livecodes'

const props = defineProps<{
	code?: string;
	styles?: string;
	loading?: 'lazy' | 'click' | 'eager';
	view?: 'split' | 'editor' | 'result';
	mode?: 'full' | 'focus' | 'simple' | 'editor' | 'codeblock' | 'result';
	height?: string;
	isMainPlayground?: boolean;
}>()

const playgroundUrl = 'https://ripple.livecodes.pages.dev'
const apiUrl = 'https://data.jsdelivr.com/v1/packages/npm/ripple'

const pkg = await fetch(apiUrl)
	.then((res) => res.json())
	.catch(() => ({}))
const latest = pkg.tags?.latest || 'latest'

const defaultContent = `
import { track } from 'ripple';

export default component App() {
	<div class="container">
		let count = track(0);

		<button onClick={() => @count++}>{@count}</button>

		if (@count > 1) {
			<div>{"Greater than 1!"}</div>
		}
	</div>

	<style>
		button {
			padding: 1rem;
			font-size: 1rem;
			cursor: pointer;
		}
	</style>
}
`.trimStart()

const hash = props.isMainPlayground ? window.location.hash : undefined

const config: EmbedOptions['config'] = {
	customSettings: { ripple: { version: latest } },
	view: props.view ?? 'split',
	mode: props.mode ?? 'full',
	activeEditor: 'script',
	script: {
		language: 'ripple',
		content: props.code ?? defaultContent,
	},
	markup: {
		language: 'html',
		hideTitle: true,
	},
	style: {
		language: 'css',
		hideTitle: true,
		content:
			props.styles ??
			`body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background: hsl(0, 0%, 18%); color: #fff }`,
	},
}

const options: EmbedOptions = {
	appUrl: hash ? `${playgroundUrl}${hash.replace('#', '?')}` : playgroundUrl,
	loading: 'eager',
	config: hash ? undefined : config,
}

let playground: Playground | undefined
const onReady = (sdk: Playground) => {
	playground = sdk

	if (props.isMainPlayground) {
		playground.watch('code', async () => {
			if (!playground) return
			const shareUrl = await playground.getShareUrl()
			window.location.hash = new URL(shareUrl).hash
		})
	}
};

const style = {
	height: (props.height ?? props.isMainPlayground) ? 'calc(100vh - 150px)' : undefined,
	minHeight: props.isMainPlayground ? '400px' : undefined,
	marginTop: props.isMainPlayground ? '1.5rem' : undefined,
}
</script>

<template>
	<LiveCodes v-bind="options" :style="style" @sdk-ready="onReady" />
</template>
