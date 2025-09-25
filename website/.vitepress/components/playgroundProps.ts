import type { EmbedOptions, Config } from 'livecodes'

export type PlaygroundProps = {
	code?: string
	styles?: string
	loading?: EmbedOptions['loading']
	view?: Config['view']
	mode?: Config['mode']
	tools?: Config['tools']
	height?: string
	isMainPlayground?: boolean
}
