<script setup lang="ts">
import { ref, watch, useTemplateRef } from 'vue'
import { useData } from 'vitepress'
import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue'
import VPSwitch from 'vitepress/dist/client/theme-default/components/VPSwitch.vue'
import LiveCodes from 'livecodes/vue'
import type { Config, EmbedOptions, Playground } from 'livecodes'
import { PlaygroundProps } from './PlaygroundProps'

const playgroundUrl = 'https://ripple.livecodes.pages.dev'
const apiUrl = 'https://data.jsdelivr.com/v1/packages/npm/ripple'

type UserSettings = { vim?: boolean; ai?: boolean }

const localStorageKey = 'ripple-playground-settings'

const getUserSettings = (): Partial<UserSettings> => {
	const userSettings = window.localStorage.getItem(localStorageKey) || '{}'
	try {
		return JSON.parse(userSettings)
	} catch (e) {
		return {}
	}
}
const setUserSettings = (userSettings: UserSettings) => {
	window.localStorage.setItem(
		localStorageKey,
		JSON.stringify({
			...getUserSettings(),
			...userSettings,
		}),
	)
}

const props = defineProps<PlaygroundProps>()
const { isDark } = useData()
let playground: Playground | undefined
const playgroundActions = useTemplateRef('playground-actions')
const tailwind = ref(false)
const vim = ref(getUserSettings().vim ?? false)
const ai = ref(getUserSettings().ai !== false)
const hash = props.isMainPlayground ? window.location.hash : undefined

const pkg = await fetch(apiUrl)
	.then((res) => res.json())
	.catch(() => ({}))
const latest = pkg.tags?.latest || 'latest'
const allVersions = pkg.versions.map((v: { version: string }) => v.version)
const versions = allVersions.filter((_v: string, i: number) => i < 30)
let versionParam = new URLSearchParams(window.location.search).get('v')
if (versionParam === 'latest') {
	versionParam = latest
} else if (!allVersions.includes(versionParam)) {
	versionParam = null
}
const version = ref(versionParam || latest)

const defaultContent = `
import { track } from 'ripple';

export default component Counter() {
  let count = track(0);
  let double = track(() => @count * 2);

  <div class="container">
    <h2>{'Counter'}</h2>
    <p>{\`Count: \${@count}\`}</p>
    <p>{\`Double: \${@double}\`}</p>

    <button onClick={() => @count--}>{'-'}</button>
    <button onClick={() => @count++}>{'+'}</button>
    if (@count !== 0) {
      <div><button onClick={() => @count = 0}>{'Reset'}</button></div>
    }
  </div>

  <style>
    .container {
      text-align: center;
    }

    button {
      font-family: "Courier New", monospace;
      font-size: 1em;
      margin: 6px;
      padding: 6px 12px;
      border: none;
      cursor: pointer;
    }

    button:hover {
      background-color: #e0e0e0;
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

const config: Partial<Config> = {
	customSettings: { ripple: { version: version.value } },
	view: props.view ?? 'split',
	mode: props.mode ?? 'full',
	tools: props.tools ?? undefined,
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
	processors: tailwind.value ? ['tailwindcss'] : [],
	editorMode: vim.value ? 'vim' : undefined,
	enableAI: ai.value,
}

const options: EmbedOptions = {
	appUrl: hash ? `${playgroundUrl}${hash.replace('#', '?')}` : playgroundUrl,
	loading: 'eager',
	config: hash ? undefined : config,
}

const getShareUrl = async () => {
	if (!playground) return
	const shareUrl = new URL(await playground.getShareUrl())
	const url = new URL(window.location.href)
	url.hash = shareUrl.hash
	url.searchParams.set('v', version.value)
	return url.href
}

const updateUrl = async () => {
	const url = await getShareUrl()
	if (!url) return
	history.replaceState(null, '', url)
}

const onReady = (sdk: Playground) => {
	playground = sdk

	// sync the UI with config from  shared URL
	playground.getConfig().then((config) => {
		if (config.processors.includes('tailwindcss')) {
			tailwind.value = true
		}

		let newConfig: Partial<Config> = {}
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

		const selectedVersion =
			versionParam || config.customSettings?.ripple?.version
		if (
			selectedVersion &&
			allVersions.includes(selectedVersion) &&
			selectedVersion !== version.value
		) {
			newConfig = {
				...newConfig,
				customSettings: {
					ripple: { version: selectedVersion },
				},
			}
			version.value = selectedVersion
		}

		if (vim.value && config.editorMode !== 'vim') {
			newConfig = {
				...newConfig,
				editorMode: 'vim',
			}
		}

		if (ai.value && !config.enableAI) {
			newConfig = {
				...newConfig,
				enableAI: true,
			}
		}

		if (Object.keys(newConfig).length > 0) {
			playground?.setConfig(newConfig)
		}
	})

	if (props.isMainPlayground) {
		playground.watch('code', async () => {
			if (!playground) return
			await updateUrl()
		})

		const readyWatcher = playground.watch('ready', async () => {
			playgroundActions.value.style.visibility = 'visible'
			readyWatcher.remove()
		})
	}
}

const style = {
	height:
		props.height ??
		(props.isMainPlayground ? 'calc(100dvh - 98px)' : undefined),
	minHeight: props.isMainPlayground ? '400px' : undefined,
	marginTop: props.isMainPlayground ? '1.5rem' : undefined,
}

const copyUrlText = ref('Copy URL')
const copyUrl = async () => {
	if (playground) {
		const url = await getShareUrl()
		if (url) {
			await navigator.clipboard.writeText(url)
			copyUrlText.value = 'Copied!'
		} else {
			copyUrlText.value = 'Error!'
		}
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

watch(tailwind, async () => {
	if (!playground) return
	await playground.setConfig({
		processors: tailwind.value ? ['tailwindcss'] : [],
	})
	await updateUrl()
})

watch(vim, async () => {
	if (!playground) return
	playground.setConfig({
		editorMode: vim.value ? 'vim' : undefined,
	})
	setUserSettings({ vim: vim.value })
})

watch(ai, async () => {
	if (!playground) return
	playground.setConfig({
		enableAI: ai.value,
	})
	setUserSettings({ ai: ai.value })
})

watch(version, async () => {
	if (!playground) return
	playground.setConfig({
		customSettings: { ripple: { version: version.value } },
	})
	await updateUrl()
})

const settingsIcon = `<svg style="height: 18px; stroke: var(--vp-c-text-1);" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><title>ionicons-v5-i</title><line x1="368" y1="128" x2="448" y2="128" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></line><line x1="64" y1="128" x2="304" y2="128" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></line><line x1="368" y1="384" x2="448" y2="384" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></line><line x1="64" y1="384" x2="304" y2="384" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></line><line x1="208" y1="256" x2="448" y2="256" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></line><line x1="64" y1="256" x2="144" y2="256" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></line><circle cx="336" cy="128" r="32" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></circle><circle cx="176" cy="256" r="32" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></circle><circle cx="336" cy="384" r="32" style="fill:none;;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></circle></g></svg>`
</script>

<template>
	<div
		v-if="props.isMainPlayground"
		ref="playground-actions"
		class="playground-actions"
		style="visibility: hidden"
	>
		<VPFlyout :button="`Version: ${version}`">
			<div
				v-for="(v, i) in versions"
				:class="`menu-item ${version === v ? 'active' : ''}`"
				@click="version = v"
				:key="i"
			>
				{{ v }}{{ latest === v ? ' (latest)' : '' }}
			</div>
		</VPFlyout>

		<VPFlyout :button="settingsIcon">
			<div class="menu-item" @click="ai = !ai">
				AI assistant<VPSwitch :aria-checked="ai"></VPSwitch>
			</div>
			<div class="menu-item" @click="tailwind = !tailwind">
				Tailwind CSS<VPSwitch :aria-checked="tailwind"></VPSwitch>
			</div>
			<div class="menu-item" @click="vim = !vim">
				Vim mode <VPSwitch :aria-checked="vim"></VPSwitch>
			</div>
		</VPFlyout>

		<VPButton
			theme="alt"
			:onclick="copyUrl"
			size="medium"
			title="Copy Shareable URL"
			class="text-btn"
			>{{ copyUrlText }}</VPButton
		>
	</div>
	<LiveCodes
		v-bind="options"
		:style="style"
		:data-default-styles="!props.isMainPlayground"
		@sdk-ready="onReady"
	/>
</template>

<style scoped>
.playground-actions {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: 1rem;
	margin-top: 1rem;
	margin-bottom: -1rem;
	padding-right: 24px;
	height: 30px;
}
@media (min-width: 768px) {
	.playground-actions {
		padding-right: 32px;
	}
}

.playground-actions button.text-btn {
	min-width: 5rem;
	padding: 0 8px;
	line-height: 28px;
	font-size: 11px;
}

.menu-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	cursor: pointer;
	white-space: nowrap;
	padding: 6px 12px;
	color: var(--vp-button-alt-hover-text);
	border-radius: 6px;

	&:hover,
	&.active {
		color: var(--vp-c-brand-1);
		background-color: var(--vp-c-default-soft);
	}
}

.VPSwitch {
	zoom: 0.8;
}

.VPSwitch[aria-checked='true'] :deep(.check) {
	transform: translateX(18px);
}

.VPSwitch[aria-checked='true'] {
	background-color: var(--vp-c-brand-3);
}
</style>
