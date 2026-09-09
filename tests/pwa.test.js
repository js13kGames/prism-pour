import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/pwa.js', import.meta.url), 'utf8')
	.replace("import { registerSW } from 'virtual:pwa-register';", '')
	.replaceAll('export ', '');

function setup(activate = async () => {}) {
	let callbacks,
		reloads = 0,
		activations = 0;
	const events = {};
	const context = vm.createContext({
		registerSW(options) {
			callbacks = options;
			return async () => {
				activations++;
				await activate();
			};
		},
		navigator: { onLine: true },
		window: {
			location: {
				reload() {
					reloads++;
				},
			},
		},
		document: { querySelector: () => ({}) },
		matchMedia: () => ({ matches: false }),
		addEventListener: (name, callback) => {
			events[name] = callback;
		},
	});
	vm.runInContext(source, context);
	return { context, callbacks, events, counts: () => ({ reloads, activations }) };
}

test('level starts without registration or waiting for an in-progress download', async () => {
	const app = setup();
	assert.equal(await app.context.updateBetweenLevels(), false);
	let checks = 0;
	app.callbacks.onRegisteredSW('', {
		waiting: null,
		installing: {},
		update() {
			checks++;
			return new Promise(() => {});
		},
	});
	await Promise.resolve();
	assert.equal(await app.context.updateBetweenLevels(), false);
	app.context.downloadUpdate();
	app.events.online();
	assert.equal(checks, 1);
	assert.equal(app.counts().activations, 0);
});

test('ready updates wait for the next level boundary and can activate offline', async () => {
	const app = setup();
	const registration = { waiting: null, update: async () => {} };
	app.callbacks.onRegisteredSW('', registration);
	app.callbacks.onNeedReload();
	assert.equal(app.counts().reloads, 0);
	assert.equal(await app.context.updateBetweenLevels(), false);
	registration.waiting = {};
	app.callbacks.onNeedReload();
	assert.equal(app.counts().reloads, 0);
	app.context.navigator.onLine = false;
	assert.equal(await app.context.updateBetweenLevels(), true);
	app.callbacks.onNeedReload();
	assert.deepEqual(app.counts(), { activations: 1, reloads: 1 });
});

test('network and activation failures do not block play or permit later surprise reloads', async () => {
	const app = setup(async () => {
		throw new Error('activation failed');
	});
	app.callbacks.onRegisteredSW('', {
		waiting: {},
		update: async () => {
			throw new Error('offline');
		},
	});
	assert.equal(await app.context.updateBetweenLevels(), false);
	app.callbacks.onNeedReload();
	assert.equal(app.counts().reloads, 0);
});
