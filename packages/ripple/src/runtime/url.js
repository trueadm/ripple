import { get, set, safe_scope, tracked } from './internal/client/runtime.js';
import { REPLACE, TrackedURLSearchParams } from './url-search-params.js';

/** @type {TrackedURL | null} */
let current_url = null;

export function get_current_url() {
	return current_url;
}

export class TrackedURL extends URL {
	#block = safe_scope();
	#protocol = tracked(super.protocol, this.#block);
	#username = tracked(super.username, this.#block);
	#password = tracked(super.password, this.#block);
	#hostname = tracked(super.hostname, this.#block);
	#port = tracked(super.port, this.#block);
	#pathname = tracked(super.pathname, this.#block);
	#hash = tracked(super.hash, this.#block);
	#search = tracked(super.search, this.#block);
	#searchParams;

	/**
	 * @param {string | URL} url
	 * @param {string | URL} [base]
	 */
	constructor(url, base) {
		url = new URL(url, base);
		super(url);

		current_url = this;
		this.#searchParams = new TrackedURLSearchParams(url.searchParams);
		current_url = null;
	}

	get hash() {
		return get(this.#hash);
	}

	set hash(value) {
		super.hash = value;
		set(this.#hash, super.hash);
	}

	get host() {
		get(this.#hostname);
		get(this.#port);
		return super.host;
	}

	set host(value) {
		super.host = value;
		set(this.#hostname, super.hostname);
		set(this.#port, super.port);
	}

	get hostname() {
		return get(this.#hostname);
	}

	set hostname(value) {
		super.hostname = value;
		set(this.#hostname, super.hostname);
	}

	get href() {
		get(this.#protocol);
		get(this.#username);
		get(this.#password);
		get(this.#hostname);
		get(this.#port);
		get(this.#pathname);
		get(this.#hash);
		get(this.#search);
		return super.href;
	}

	set href(value) {
		super.href = value;
		set(this.#protocol, super.protocol);
		set(this.#username, super.username);
		set(this.#password, super.password);
		set(this.#hostname, super.hostname);
		set(this.#port, super.port);
		set(this.#pathname, super.pathname);
		set(this.#hash, super.hash);
		set(this.#search, super.search);
		this.#searchParams[REPLACE](super.searchParams);
	}

	get password() {
		return get(this.#password);
	}

	set password(value) {
		super.password = value;
		set(this.#password, super.password);
	}

	get pathname() {
		return get(this.#pathname);
	}

	set pathname(value) {
		super.pathname = value;
		set(this.#pathname, super.pathname);
	}

	get port() {
		return get(this.#port);
	}

	set port(value) {
		super.port = value;
		set(this.#port, super.port);
	}

	get protocol() {
		return get(this.#protocol);
	}

	set protocol(value) {
		super.protocol = value;
		set(this.#protocol, super.protocol);
	}

	get search() {
		return get(this.#search);
	}

	set search(value) {
		super.search = value;
		set(this.#search, value);
		this.#searchParams[REPLACE](super.searchParams);
	}

	get username() {
		return get(this.#username);
	}

	set username(value) {
		super.username = value;
		set(this.#username, super.username);
	}

	get origin() {
		get(this.#protocol);
		get(this.#hostname);
		get(this.#port);
		return super.origin;
	}

	get searchParams() {
		return this.#searchParams;
	}

	toString() {
		return this.href;
	}

	toJSON() {
		return this.href;
	}
}
