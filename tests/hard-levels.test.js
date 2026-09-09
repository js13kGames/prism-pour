import test from 'node:test';
import assert from 'node:assert/strict';
import { solveBounded, evaluateCandidate, searchHardLevels } from '../src/hard-levels.js';
import { move, won } from '../src/engine.js';

test('timeouts are unknown, blocked mixed tubes are proven dead ends', () => {
	assert.equal(
		solveBounded(
			[
				[0, 1],
				[1, 0],
			],
			2,
			{},
		).status,
		'dead-end',
	);
	assert.equal(solveBounded([[0, 1], [1, 0], []], 2, { maxVisits: 0 }).status, 'unknown');
});
test('candidate solution replays legally and completes the original board', () => {
	const candidate = evaluateCandidate({ seed: 42, colors: 2, capacity: 2, emptyTubes: 2 });
	assert(candidate);
	let board = candidate.board;
	for (const [a, z] of candidate.solution) {
		const result = move(board, a, z, 2);
		assert(result);
		board = result.board;
	}
	assert(won(board, 2));
	assert.equal(candidate.solution.length, candidate.metrics.minimum);
	assert.equal(candidate.metrics.sampled, 24);
	assert.equal(candidate.metrics.unknown, 0);
});
test('batch reports resumable seeds and keeps the highest scoring proven board', () => {
	const records = [];
	const result = searchHardLevels(
		{ seed: 42, colors: 2, capacity: 2, emptyTubes: 1 },
		{
			candidates: 3,
			seconds: 10,
			report: (progress, candidate) => records.push({ progress, candidate }),
		},
	);
	assert.equal(result.attempted, 3);
	assert.equal(records.at(-1).progress.nextSeed, 45);
	assert.equal(
		result.best.score,
		Math.max(...records.filter((r) => r.candidate).map((r) => r.candidate.score)),
	);
});
