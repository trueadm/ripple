<script setup lang="ts">
import { ref, watch } from 'vue'
import { useData } from 'vitepress'
import VpButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
import LiveCodes from 'livecodes/vue'
import type { EmbedOptions, Playground } from 'livecodes'
import { playgroundProps } from './playgroundProps'

const props = defineProps<playgroundProps>()
const { isDark } = useData()

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

const getStyle = () => ({
	language: 'css' as const,
	content: props.styles ?? '',
	hiddenContent: `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; ${isDark.value ? 'background: hsl(0, 0%, 18%); color: #fff' : ''} }`,
	hideTitle: true,
})

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
	style: getStyle(),
	theme: isDark.value ? 'dark' : 'light',
}

const options: EmbedOptions = {
	appUrl: hash ? `${playgroundUrl}${hash.replace('#', '?')}` : playgroundUrl,
	loading: 'eager',
	config: hash ? undefined : config,
}

let playground: Playground | undefined
const isReady = ref(false)
const onReady = (sdk: Playground) => {
	playground = sdk

	playground.getConfig().then((config) => {
		let newConfig = {}
		if (!config.markup.hideTitle || !config.style.hideTitle) {
			newConfig = {
				markup: { ...config.markup, hideTitle: true },
				style: { ...config.style, hideTitle: true },
			}
		}
		if (
			(isDark.value && config.theme !== 'dark') ||
			(!isDark.value && config.theme !== 'light')
		) {
			newConfig = {
				...newConfig,
				theme: isDark.value ? 'dark' : 'light',
				style: getStyle(),
			}
		}
		if (Object.keys(newConfig).length > 0) {
			playground?.setConfig(newConfig)
		}
	})

	if (props.isMainPlayground) {
		playground.watch('code', async () => {
			if (!playground) return
			const shareUrl = await playground.getShareUrl()
			window.location.hash = new URL(shareUrl).hash
		})
		playground.watch('ready', async () => {
			isReady.value = true
		})
	}
}

const style = {
	height:
		(props.height ?? props.isMainPlayground) ? 'calc(100vh - 98px)' : undefined,
	minHeight: props.isMainPlayground ? '400px' : undefined,
	marginTop: props.isMainPlayground ? '1.5rem' : undefined,
}

const copyUrlText = ref('Copy URL')
const copyUrl = async () => {
	if (playground) {
		const shareUrl = new URL(await playground.getShareUrl())
		const url = new URL(window.location.href)
		url.hash = shareUrl.hash
		await navigator.clipboard.writeText(url.href)
		copyUrlText.value = 'Copied!'
		setTimeout(() => {
			copyUrlText.value = 'Copy URL'
		}, 1000)
	}
}

watch(isDark, () => {
	if (playground) {
		playground.setConfig({
			theme: isDark.value ? 'dark' : 'light',
			style: getStyle(),
		})
	}
})
</script>

<template>
	<div v-if="props.isMainPlayground" class="playground-actions">
		<VpButton
			v-if="isReady"
			theme="alt"
			:onclick="copyUrl"
			size="medium"
			title="Copy Shareable URL"
			class="text-btn"
			>{{ copyUrlText }}</VpButton
		>
	</div>
	<LiveCodes
		v-bind="options"
		:style="style"
		:data-default-styles="!props.isMainPlayground"
		@sdk-ready="onReady"
	/>
</template>
