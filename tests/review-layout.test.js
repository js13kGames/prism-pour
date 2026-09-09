import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout, reviewArrow } from '../src/review-layout.js';

test('large boards wrap, preserve tube order, and fit all tube heights', () => {
	for (const width of [240, 320, 640, 900]) {
		for (const count of [6, 14, 18]) {
			for (const height of [194, 346, 498]) {
				const layout = reviewLayout(count, height, width);
				assert(layout.columns >= 6 && layout.columns <= 8);
				assert.equal(layout.rows, Math.ceil(count / layout.columns));
				for (let i = 0; i < count; i++) {
					const p = layout.position(i);
					assert(p.x - 41 > 8 && p.x + 41 < layout.width - 8);
					assert(p.y + height + 24 < layout.height);
					if (i >= layout.columns) assert(p.y > layout.position(i - layout.columns).y);
				}
			}
		}
	}
});

test('cross-row arrows are continuous arcs ending at the destination in both directions', () => {
	const layout = reviewLayout(14, 194, 320);
	for (const [from, to] of [
		[0, 13],
		[13, 0],
		[0, 6],
		[6, 0],
	]) {
		for (const optimal of [false, true]) {
			const route = reviewArrow(layout, from, to, optimal);
			assert(route.path.includes('Q'));
			assert(!/[HV]/.test(route.path));
			assert(route.path.endsWith(` ${layout.position(to).y - 4}`));
			assert(route.labelX >= 55 && route.labelX <= layout.width - 55);
			assert(Number.isFinite(route.labelY));
		}
		assert.notEqual(reviewArrow(layout, from, to).path, reviewArrow(layout, from, to, true).path);
	}
});

test('same-row arrows stay above their row and resize changes columns', () => {
	const mobile = reviewLayout(14, 194, 320),
		desktop = reviewLayout(14, 194, 640);
	assert(mobile.columns < desktop.columns);
	assert.equal(mobile.columns, 6);
	const route = reviewArrow(mobile, 0, 1);
	assert(route.path.includes('Q'));
	assert(route.labelY < mobile.position(0).y);
});
