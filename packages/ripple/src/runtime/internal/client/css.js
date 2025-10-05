import { DEV } from 'esm-env';

export function remove_ssr_css() {
	if (!document || typeof requestAnimationFrame !== 'function') {
		return;
	}

	remove_styles();
}

function remove_styles() {
	if (DEV) {
		const styles = document.querySelector('style[data-vite-dev-id]');
		if (styles) {
			remove();
		} else {
			requestAnimationFrame(remove_styles);
		}
	} else {
		remove_when_css_loaded(() => requestAnimationFrame(remove));
	}
}

function remove() {
	document.querySelectorAll('style[data-ripple-ssr]').forEach((el) => el.remove());
}

/**
 * @param {function} callback
 * @returns {void}
 */
function remove_when_css_loaded(callback) {
	/** @type {HTMLLinkElement[]} */
	const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
	let remaining = links.length;

	if (remaining === 0) {
		callback();
		return;
	}

	const done = () => {
		remaining--;
		if (remaining === 0) {
			// clean up all listeners
			links.forEach((link) => {
				link.removeEventListener('load', onLoad);
				link.removeEventListener('error', onError);
			});
			callback();
		}
	};

	function onLoad() {
		done();
	}
	function onError() {
		done();
	}

	links.forEach((link) => {
		if (link.sheet) {
			// already loaded (possibly cached)
			done();
		} else {
			link.addEventListener('load', onLoad);
			link.addEventListener('error', onError);
		}
	});
}
