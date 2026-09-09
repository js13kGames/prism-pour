import { reviewMoves } from './move-review.js';
import { optimal } from './optimal.js';

self.onmessage = ({ data }) => {
	try {
		if (data.operation === 'solve') {
			optimal(
				data.board,
				(result) => self.postMessage({ operation: 'solve', ...result }),
				data.cap,
			);
			return;
		}
		if (data.operation === 'review') {
			reviewMoves(data.board, data.events, data.cap, (review, count) =>
				self.postMessage({ operation: 'review', review, count }),
			);
			self.postMessage({ operation: 'review', done: true });
			return;
		}
		throw new Error('Unknown solver operation');
	} catch {
		self.postMessage({ operation: data.operation, error: true });
	}
};
