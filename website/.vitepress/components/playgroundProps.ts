import type { EmbedOptions, Config } from 'livecodes'

export type playgroundProps = {
	code?: string
	styles?: string
	loading?: EmbedOptions['loading']
	view?: Config['view']
	mode?: Config['mode']
	height?: string
	version?: string
	isMainPlayground?: boolean
}
