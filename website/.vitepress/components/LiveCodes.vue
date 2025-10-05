<script setup lang="ts">
import { ref, watch, useTemplateRef } from 'vue'
import { useData } from 'vitepress'
import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue'
import VPSwitch from 'vitepress/dist/client/theme-default/components/VPSwitch.vue'
import LiveCodes from 'livecodes/vue'
import type { Config, EmbedOptions, Playground } from 'livecodes'
import { PlaygroundProps } from './PlaygroundProps'
import { examples } from '../../docs/examples'

const playgroundUrl = 'https://ripple.livecodes.pages.dev'
const apiUrl = 'https://data.jsdelivr.com/v1/packages/npm/ripple'

type UserSettings = { vim?: boolean; ai?: boolean; fontSize?: number }

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
const themeColor =
	window
		.getComputedStyle(document.documentElement)
		.getPropertyValue('--vp-c-brand-3') || '#2d6dbf'
let playground: Playground | undefined
const playgroundActions = useTemplateRef('playground-actions')
const title = ref(props.code ? undefined : 'Counter')
const tailwind = ref(false)
const vim = ref(getUserSettings().vim ?? false)
const ai = ref(getUserSettings().ai !== false)
const fontSize = ref(getUserSettings().fontSize || 12)
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
	title: title.value,
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
	themeColor,
	fontSize: props.isMainPlayground ? fontSize.value : undefined,
	processors: tailwind.value ? ['tailwindcss'] : [],
	editorMode: vim.value ? 'vim' : undefined,
	enableAI: ai.value,
}

const options: EmbedOptions = {
	appUrl: playgroundUrl + (hash || ''),
	loading: 'eager',
	config: hash ? undefined : config,
}

const getShareUrl = async () => {
	if (!playground) return
	const shareUrl = new URL(await playground.getShareUrl())
	const url = new URL(window.location.href)
	url.hash = shareUrl.hash
	url.searchParams.set('v', version.value)
	if (title.value) {
		url.searchParams.set('title', title.value)
	}
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
		if (
			config.title?.trim() &&
			config.title !== 'Untitled Project' &&
			config.title !== title.value
		) {
			title.value = config.title
		}

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

		if (config.themeColor !== themeColor) {
			newConfig = {
				...newConfig,
				themeColor,
			}
		}

		if (props.isMainPlayground && config.fontSize !== fontSize.value) {
			newConfig = {
				...newConfig,
				fontSize: fontSize.value,
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

const getPlaygroundStyle = () => ({
	height:
		props.height ??
		(props.isMainPlayground ? 'calc(100dvh - 110px)' : undefined),
	minHeight: props.isMainPlayground ? '400px' : undefined,
	marginTop: props.isMainPlayground ? '1.5rem' : undefined,
	borderRadius: props.isMainPlayground ? undefined : '8px',
	border: props.isMainPlayground
		? undefined
		: `1px solid ${isDark.value ? '#333' : '#ddd'}`,
})
const playgroundStyle = ref(getPlaygroundStyle())

watch(isDark, () => {
	if (playground) {
		playground.setConfig({
			theme: isDark.value ? 'dark' : 'light',
			style: getStyle(),
		})
	}
	playgroundStyle.value = getPlaygroundStyle()
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

watch(fontSize, async () => {
	if (!playground) return
	playground.setConfig({
		fontSize: fontSize.value,
	})
	setUserSettings({ fontSize: fontSize.value })
})

watch(title, async () => {
	if (!playground) return
	playground.setConfig({
		title: title.value,
	})
	await updateUrl()
})

watch(version, async () => {
	if (!playground) return
	playground.setConfig({
		customSettings: { ripple: { version: version.value } },
	})
	await updateUrl()
})

const changeVersion = async (input: HTMLInputElement | null) => {
	if (!input) return
	const v = input.value
	if (allVersions.includes(v)) {
		version.value = v
	}
	if (v === 'latest' || v === '') {
		version.value = latest
	}
}

const loadExample = async (example: { title: string; code: string }) => {
	if (!playground) return
	await playground.setConfig({
		title: example.title,
		script: {
			language: 'ripple',
			content: example.code,
		},
		...(example.code.includes('console.')
			? { tools: { active: 'console', status: 'open' } }
			: undefined),
	})
	title.value = example.title
	await updateUrl()
}

window.addEventListener('resize', () => {
	if (!window.location.href.includes('playground')) return
	// fixes the issue on mobile with landscape orientation, user scrolls down,
	// then changes orientation to landscape and is not able to scroll back to top
	window.scrollTo(0, 0)
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
		<VPFlyout button="Examples" class="examples">
			<button
				v-for="(example, i) in examples"
				class="menu-item clickable"
				@click="() => loadExample(example)"
				:key="i"
			>
				{{ example.title }}
			</button>
		</VPFlyout>

		<input id="title-input" type="text" v-model="title" />

		<VPFlyout
			:button="`<span id='version-label'>Version: </span><span id='v-label'>v</span>${version}`"
			class="version-menu"
		>
			<button
				v-for="(v, i) in versions"
				:class="`menu-item clickable ${version === v ? 'active' : ''}`"
				@click="version = v"
				:key="i"
			>
				{{ v }}{{ latest === v ? ' (latest)' : '' }}
			</button>
		</VPFlyout>

		<VPFlyout :button="settingsIcon" title="Settings">
			<div class="menu-item version-input">
				<label for="version-input">Version: </label>
				<input
					id="version-input"
					type="text"
					:value="version"
					@input="(ev: InputEvent) => changeVersion(ev?.target)"
				/>
			</div>
			<div class="menu-item clickable" @click="ai = !ai">
				AI assistant<VPSwitch :aria-checked="ai"></VPSwitch>
			</div>
			<div class="menu-item clickable" @click="tailwind = !tailwind">
				Tailwind CSS<VPSwitch :aria-checked="tailwind"></VPSwitch>
			</div>
			<div class="menu-item clickable" @click="vim = !vim">
				Vim mode <VPSwitch :aria-checked="vim"></VPSwitch>
			</div>
			<div class="menu-item font-size-selector">
				<button
					title="Font size: small"
					style="font-size: 0.8rem"
					:class="[fontSize === 12 ? 'active' : '']"
					@click="fontSize = 12"
				>
					A
				</button>
				<button
					title="Font size: medium"
					style="font-size: 1rem"
					:class="[fontSize === 14 ? 'active' : '']"
					@click="fontSize = 14"
				>
					A
				</button>
				<button
					title="Font size: large"
					style="font-size: 1.2rem"
					:class="[fontSize === 16 ? 'active' : '']"
					@click="fontSize = 16"
				>
					A
				</button>
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
		:style="playgroundStyle"
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
	margin-inline: auto;
	padding-right: 24px;
	height: 30px;
	max-width: 1440px;

	.examples {
		margin-left: 20px;

		& > * {
			right: unset;
		}
	}

	.version-input {
		display: none;
	}
}

@media (min-width: 768px) {
	.playground-actions {
		padding-right: 32px;
	}
}

@media (max-width: 768px) {
	.examples {
		margin-left: 12px !important;
		margin-right: auto;
	}
}

@media (max-width: 480px) {
	.playground-actions {
		gap: unset;

		.VPFlyout.version-menu {
			display: none;
		}

		.version-input {
			display: flex;
		}
	}
}

.playground-actions .VPFlyout {
	height: 42px;
	display: flex;
	align-items: center;
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
	white-space: nowrap;
	padding: 6px 12px;
	color: var(--vp-button-alt-hover-text);
	width: 100%;

	&.clickable {
		cursor: pointer;

		&:hover,
		&:focus,
		&.active {
			border-radius: 6px;
			color: var(--vp-c-brand-1);
			background-color: var(--vp-c-default-soft);
		}
	}
}

.menu-item.font-size-selector button {
	padding: 6px 12px;
	color: var(--vp-button-alt-hover-text);
	border-radius: 6px;

	&:hover,
	&:focus,
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
	background-color: var(--vp-c-brand-1);
}

input[type='text'] {
	flex: 1;
	border: 1px solid var(--vp-input-border-color);
	border-radius: 6px;
	padding-inline: 8px;
	width: 0;
	max-width: 30rem;
	margin-right: auto;
}

/* global styles */
:global(body:has(.main-playground)) {
	overflow: hidden;
}

:global(body:has(.main-playground) .VPFooter) {
	display: none;
}

:global(body:has(.main-playground) .VPNavBar .divider-line) {
	background-color: var(--vp-c-gutter);
}

@media (max-height: 500px) {
	:global(body:has(.main-playground)) {
		overflow: auto; /* avoid hiding the lower part of playground on mobile (landscape) */
	}

	:global(.VPHome:has(.main-playground)) {
		margin-bottom: 0;
	}
}

:global(.VPHome .container:has(.main-playground)) {
	padding: 0;
	max-width: unset;
}

:global(.playground-actions .VPFlyout > .button) {
	height: 42px !important;
	overflow: clip;
}

:global(.playground-actions .VPFlyout > .menu) {
	margin-top: -10px !important;
}

:global(.main-playground .VPMenu) {
	max-height: calc(100dvh - 112px);
}

:global(.main-playground #v-label) {
	display: none;
}

@media (max-width: 768px) {
	:global(.main-playground #version-label) {
		display: none;
	}

	:global(.main-playground #v-label) {
		display: unset;
	}
}
</style>
