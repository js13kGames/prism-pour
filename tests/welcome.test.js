import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installWelcome } from '../src/welcome.js';

function setup(storage) {
	let opened = 0,
		dismissed = 0,
		focused = 0,
		closed;
	const dialog = {
		showModal() {
			opened++;
		},
		close() {
			closed();
		},
		addEventListener(event, handler) {
			assert.equal(event, 'close');
			closed = handler;
		},
	};
	const play = {},
		close = {},
		debug = {
			focus() {
				focused++;
			},
		};
	const shown = installWelcome({
		dialog,
		play,
		close,
		debug,
		storage,
		settle() {},
		onDismiss() {
			dismissed++;
		},
	});
	return { shown, play, close, debug, dialog, counts: () => ({ opened, dismissed, focused }) };
}

test('welcome appears once, remembers dismissal, and remains available from debug', () => {
	const values = new Map([['prism-pour', 'saved progress']]);
	const storage = () => ({
		getItem: (key) => values.get(key),
		setItem: (key, value) => values.set(key, value),
	});
	const first = setup(storage);
	assert.equal(first.shown, true);
	first.play.onclick();
	assert.equal(values.get('prism-pour'), 'saved progress');
	const later = setup(storage);
	assert.equal(later.shown, false);
	later.debug.onclick();
	later.close.onclick();
	assert.deepEqual(later.counts(), { opened: 1, dismissed: 0, focused: 1 });
});

test('Escape dismissal is remembered through the dialog close event', () => {
	let seen;
	const page = setup(() => ({
		getItem: () => seen,
		setItem: (_, value) => {
			seen = value;
		},
	}));
	page.dialog.close();
	assert.equal(seen, 'true');
	assert.equal(page.counts().dismissed, 1);
});

test('unavailable storage never blocks starting the game', () => {
	const page = setup(() => {
		throw new Error('Storage unavailable');
	});
	assert.equal(page.shown, true);
	page.play.onclick();
	assert.equal(page.counts().dismissed, 1);
});
