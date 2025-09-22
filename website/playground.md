---
title: Playground
layout: home
---

<script setup>
import Playground from './.vitepress/components/Playground.vue'
</script>

# Playground

<ClientOnly>
	<div style="min-height: calc(100vh - 200px); margin-bottom: -90px">
		<Suspense>
				<Playground :is-main-playground="true" />
		</Suspense>
	</div>
</ClientOnly>
