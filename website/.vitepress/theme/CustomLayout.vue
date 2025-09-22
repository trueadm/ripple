<script setup>
import DefaultTheme from 'vitepress/theme'

const { Layout } = DefaultTheme
</script>

<template>
	<Layout>
		<template #doc-before>
			<div class="warning custom-block">
				<p></p>
				<p class="custom-block-title">
					The documentation is a work in progress.
					Expect terse and incomplete information!
				</p>
			</div>
			<br>
		</template>
	</Layout>
</template>
