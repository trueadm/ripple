<script setup lang="ts">
import LiveCodes from './LiveCodes.vue'
import { playgroundProps } from './playgroundProps'

const props = defineProps<playgroundProps>()
</script>

<template>
	<ClientOnly>
		<Suspense>
			<LiveCodes v-bind="props" />
		</Suspense>
	</ClientOnly>
</template>
