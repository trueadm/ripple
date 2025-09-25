<script setup lang="ts">
import { useSlots, computed } from 'vue'
import Playground from './Playground.vue'

const props = defineProps<{ console?: boolean }>()
const slots = useSlots()
const slotContentAsString = computed(() => {
	if (!slots.default) {
		return '' // No default slot content
	}

	const nodes = slots.default() // Get VNodes of the default slot
	let text = ''

	function extractText(vnodes: any[]) {
		vnodes.forEach((node) => {
			if (typeof node.children === 'string') {
				text += node.children
			} else if (Array.isArray(node.children)) {
				extractText(node.children) // Recursively extract from child VNodes
			}
		})
	}

	extractText(nodes)
	text = modifyContent(text)
	return text
})

const modifyContent = (content: string) => {
	if (content.startsWith('ripple')) {
		content = content.slice('ripple'.length)
	}
	if (!content.includes('export default component')) {
		content = content.replace('export component', 'export default component')
	}
	if (!content.includes('export default component')) {
		content = content.replace('component', 'export default component')
	}
	return content
}

const tools = props.console ? { status: 'open' } : undefined
const codeLines = slotContentAsString.value.split('\n').length
const height =
	codeLines > 25
		? '500px'
		: codeLines > 20
			? '450px'
			: codeLines > 15
				? '400px'
				: undefined
</script>

<template>
	<PluginTabs sharedStateKey="code">
		<PluginTabsTab label="Code">
			<slot />
		</PluginTabsTab>
		<PluginTabsTab label="Playground">
			<Playground :code="slotContentAsString" :height="height" :tools="tools" />
		</PluginTabsTab>
	</PluginTabs>
</template>
