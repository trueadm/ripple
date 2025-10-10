declare var container: HTMLDivElement;
declare var error: string | undefined;
declare function render(component: () => void): void;

interface HTMLElement {
	// We don't care about checking if it returned an element or null in tests
	// because if it returned null, those tests will fail anyway. This
	// typing drastically simplifies testing: you don't have to check if the
	// query returned null or an actual element, and you don't have to do
	// optional chaining everywhere (elem?.textContent)
	querySelector(selectors: string): HTMLElement;
}
