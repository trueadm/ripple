<script setup lang="ts">
import { useSlots, computed } from 'vue'
import Playground from './Playground.vue'
import { Config } from 'livecodes'

const props = defineProps<{
	height?: string
	tools?: Config['tools']
}>()
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
</script>

<template>
	<PluginTabs sharedStateKey="code">
		<PluginTabsTab label="Code">
			<slot />
		</PluginTabsTab>
		<PluginTabsTab label="Playground">
			<Playground
				:code="slotContentAsString"
				:height="props.height"
				:tools="props.tools"
			/>
		</PluginTabsTab>
	</PluginTabs>
</template>
