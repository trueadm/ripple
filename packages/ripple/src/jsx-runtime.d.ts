/**
 * Ripple JSX Runtime Type Definitions
 * Ripple components are imperative and don't return JSX elements
 */

// Ripple components don't return JSX elements - they're imperative
export type ComponentType<P = {}> = (props: P) => void;

/**
 * Create a JSX element (for elements with children)
 * In Ripple, this doesn't return anything - components are imperative
 */
export function jsx(
	type: string | ComponentType<any>,
	props?: any,
	key?: string | number | null,
): void;

/**
 * Create a JSX element with static children (optimization for multiple children)
 * In Ripple, this doesn't return anything - components are imperative
 */
export function jsxs(
	type: string | ComponentType<any>,
	props?: any,
	key?: string | number | null,
): void;

/**
 * JSX Fragment component
 * In Ripple, fragments are imperative and don't return anything
 */
export function Fragment(props: { children?: any }): void;

export type ClassValue = string | import('clsx').ClassArray | import('clsx').ClassDictionary;

// Base HTML attributes
interface HTMLAttributes {
	class?: ClassValue | undefined | null;
	className?: string;
	id?: string;
	style?: string | Record<string, string | number>;
	onClick?: (event: MouseEvent) => void;
	onInput?: (event: InputEvent) => void;
	onChange?: (event: Event) => void;
	children?: any;
	[key: string]: any;
}

// Global JSX namespace for TypeScript
declare global {
	namespace JSX {
		// In Ripple, JSX expressions don't return elements - they're imperative
		type Element = void;

		interface IntrinsicElements {
			// HTML elements with basic attributes
			div: HTMLAttributes;
			span: HTMLAttributes;
			p: HTMLAttributes;
			h1: HTMLAttributes;
			h2: HTMLAttributes;
			h3: HTMLAttributes;
			h4: HTMLAttributes;
			h5: HTMLAttributes;
			h6: HTMLAttributes;
			button: HTMLAttributes & {
				type?: 'button' | 'submit' | 'reset';
				disabled?: boolean;
			};
			input: HTMLAttributes & {
				type?: string;
				value?: string | number;
				placeholder?: string;
				disabled?: boolean;
			};
			form: HTMLAttributes;
			a: HTMLAttributes & {
				href?: string;
				target?: string;
			};
			img: HTMLAttributes & {
				src?: string;
				alt?: string;
				width?: string | number;
				height?: string | number;
			};
			// Add more as needed...
			[elemName: string]: HTMLAttributes;
		}

		interface ElementChildrenAttribute {
			children: {};
		}
	}
}
