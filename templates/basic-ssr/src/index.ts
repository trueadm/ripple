import { mount } from 'ripple';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.ripple';

// TODO: Hydration is not yet implemented in Ripple.
// Currently this will re-render the entire app on the client side.
// True hydration (attaching event handlers without re-rendering) is coming soon.
mount(App, {
	target: document.getElementById('root'),
	hydrate: true, // placeholder for future hydration support
});
