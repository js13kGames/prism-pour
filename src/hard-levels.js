import { generate, move, won, clone } from './engine.js';
import { optimal } from './optimal.js';

export const SCORING_VERSION = 1;
const key = (b) =>
	b
		.map((t) => t.join(','))
		.sort()
		.join('|');
export function choices(board, cap) {
	const seen = new Set([key(board)]),
		result = [];
	for (let a = 0; a < board.length; a++)
		for (let z = 0; z < board.length; z++) {
			const m = move(board, a, z, cap);
			if (!m || seen.has(key(m.board))) continue;
			seen.add(key(m.board));
			result.push({ board: m.board, move: [a, z] });
		}
	return result;
}
export function solveBounded(board, cap, limits) {
	let answer;
	try {
		optimal(
			board,
			(r) => {
				if (r.exact) answer = r;
			},
			cap,
			limits,
		);
		return { status: 'solved', ...answer };
	} catch (error) {
		if (error.code === 'BUDGET') return { status: 'unknown' };
		if (error.code === 'UNSOLVABLE') return { status: 'dead-end' };
		throw error;
	}
}
export function validateSearch(options) {
	for (const [name, min, max] of [
		['seed', 1, 2147483647],
		['colors', 2, 12],
		['capacity', 2, 12],
		['emptyTubes', 1, 6],
	]) {
		if (!Number.isInteger(options[name]) || options[name] < min || options[name] > max)
			throw Error(`Invalid ${name}: expected ${min}–${max}`);
	}
}
// Pure analysis module: no DOM, workers, storage, or Node-specific dependencies.
export function evaluateCandidate(options, { deadline = Infinity, maxVisits = 15000 } = {}) {
	validateSearch(options);
	const { seed, colors, capacity: cap, emptyTubes } = options;
	const board = generate(seed, colors, cap, emptyTubes).board;
	const solve = (b) => solveBounded(b, cap, { deadline, maxVisits });
	const root = solve(board);
	if (root.status !== 'solved' || root.minimum === 0) return null;
	let random = seed >>> 0;
	const rnd = () => {
		random ^= random << 13;
		random ^= random >>> 17;
		random ^= random << 5;
		return (random >>> 0) / 4294967296;
	};
	const metrics = {
		minimum: root.minimum,
		sampled: 0,
		deadEnds: 0,
		unknown: 0,
		deadEndDepthTotal: 0,
		optimalChoices: 0,
		ratedChoices: 0,
		mistakeCost: 0,
		firstCompletion: root.minimum,
	};
	// Explore plausible short deviations. Exhausting a solve budget is NOT a dead end.
	for (let trial = 0; trial < 24 && Date.now() < deadline; trial++) {
		let b = clone(board),
			depth = 0;
		const visited = new Set([key(b)]);
		for (; depth < 1 + (trial % 5); depth++) {
			if (won(b, cap)) break;
			const next = choices(b, cap).filter((c) => !visited.has(key(c.board)));
			if (!next.length) break;
			b = next[Math.floor(rnd() * next.length)].board;
			visited.add(key(b));
		}
		const result = solve(b);
		metrics.sampled++;
		if (result.status === 'dead-end') {
			metrics.deadEnds++;
			metrics.deadEndDepthTotal += depth;
		}
		if (result.status === 'unknown') metrics.unknown++;
	}
	let b = board;
	for (let step = 0; step < Math.min(root.path.length, 6) && Date.now() < deadline; step++) {
		for (const child of choices(b, cap).slice(0, 12)) {
			const result = solve(child.board);
			if (result.status !== 'solved') continue;
			const cost = 1 + result.minimum - (root.minimum - step);
			metrics.ratedChoices++;
			if (cost === 0) metrics.optimalChoices++;
			metrics.mistakeCost += cost;
		}
		b = move(b, ...root.path[step], cap).board;
	}
	b = board;
	for (let step = 0; step < root.path.length; step++) {
		b = move(b, ...root.path[step], cap).board;
		if (b.some((t) => t.length === cap && t.every((c) => c === t[0]))) {
			metrics.firstCompletion = step + 1;
			break;
		}
	}
	// Dead-end evidence dominates; unresolved probes remain in the denominator.
	const trapRate = metrics.deadEnds / Math.max(1, metrics.sampled);
	const trapDepth = metrics.deadEnds ? metrics.deadEndDepthTotal / metrics.deadEnds : 0;
	const score =
		1000 * trapRate +
		(metrics.deadEnds ? 100 / (1 + trapDepth) : 0) +
		root.minimum +
		(10 * metrics.mistakeCost) / Math.max(1, metrics.ratedChoices) +
		10 * (metrics.ratedChoices ? 1 - metrics.optimalChoices / metrics.ratedChoices : 0) +
		metrics.firstCompletion;
	return { version: SCORING_VERSION, options, board, solution: root.path, score, metrics };
}
export function searchHardLevels(
	options,
	{ seconds = 30, candidates = Infinity, maxVisits = 15000, report = () => {} } = {},
) {
	validateSearch(options);
	if (!(seconds > 0) || !(candidates > 0) || !(maxVisits > 0))
		throw Error('Search budgets must be positive');
	const deadline = Date.now() + seconds * 1000;
	let best = null,
		attempted = 0,
		proven = 0;
	while (attempted < candidates && Date.now() < deadline) {
		const seed = 1 + ((options.seed - 1 + attempted) % 2147483647);
		const candidate = evaluateCandidate({ ...options, seed }, { deadline, maxVisits });
		attempted++;
		if (candidate) proven++;
		if (candidate && (!best || candidate.score > best.score)) best = candidate;
		report({ attempted, proven, best, nextSeed: 1 + (seed % 2147483647) }, candidate);
	}
	return { attempted, proven, best };
}
