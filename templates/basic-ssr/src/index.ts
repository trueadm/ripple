import { mount } from 'ripple';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.ripple';

// Hydrate the server-rendered content
mount(App, {
	target: document.getElementById('root'),
	hydrate: true,
});
