import DefaultTheme from 'vitepress/theme'
import './styles.css'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import CustomLayout from './CustomLayout.vue'

export default {
	extends: DefaultTheme,
	Layout: CustomLayout,
	enhanceApp({ app }) {
		enhanceAppWithTabs(app)
	}
}
