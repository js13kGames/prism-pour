import { clone, move, CAP } from './engine.js';
import { optimal } from './optimal.js';

// Rate against exact remaining distance, accepting every shortest-path branch.
export function reviewMoves(initial, events, cap = CAP, report = () => {}) {
	let board = clone(initial);
	const cache = new Map(),
		reviews = [];
	function solve(b) {
		const key = JSON.stringify(b);
		if (!cache.has(key)) {
			optimal(
				b,
				(result) => {
					if (result.exact) cache.set(key, result);
				},
				cap,
			);
		}
		return cache.get(key);
	}
	for (const event of events) {
		if (event === 'extra') {
			board.push([]);
			continue;
		}
		const [from, to] = event;
		const result = move(board, from, to, cap);
		if (!result) throw Error('Invalid recorded move');
		const before = solve(board),
			after = solve(result.board);
		const cost = 1 + after.minimum - before.minimum;
		const recommended = before.path[0];
		const review = {
			from,
			to,
			before: before.minimum,
			after: after.minimum,
			cost,
			good: cost === 0,
			recommended,
			board: result.board,
			position: clone(board),
		};
		reviews.push(review);
		report(review, reviews.length);
		board = result.board;
	}
	return reviews;
}
