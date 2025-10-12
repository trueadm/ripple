
export declare function render(
	component: () => void,
): Promise<{ head: string; body: string; css: Set<string> }>;