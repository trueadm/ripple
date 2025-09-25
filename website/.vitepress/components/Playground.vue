<script setup lang="ts">
import LiveCodes from './LiveCodes.vue'
import { PlaygroundProps } from './PlaygroundProps'

const props = defineProps<PlaygroundProps>()
</script>

<template>
	<ClientOnly>
		<Suspense>
			<LiveCodes v-bind="props" />
		</Suspense>
	</ClientOnly>
</template>
