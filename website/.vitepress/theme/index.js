import DefaultTheme from 'vitepress/theme'
import './styles.css'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import Code from '../components/Code.vue'
import Playground from '../components/Playground.vue'

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		enhanceAppWithTabs(app)
		app.component('Code', Code)
		app.component('Playground', Playground)
	},
}
