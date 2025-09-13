<script setup>
import DefaultTheme from 'vitepress/theme'

const { Layout } = DefaultTheme
</script>

<template>
	<Layout>
		<template #doc-before>
			<div class="warning custom-block">
				<span>
					Most of the docs are currently bulk imported from llms.txt.
					Expect terse and incomplete information!
				</span>
			</div>
			<br>
		</template>
	</Layout>
</template>
