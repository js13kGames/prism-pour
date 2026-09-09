import { reviewMoves } from './move-review.js';
self.onmessage = ({ data }) => {
	try {
		reviewMoves(data.board, data.events, data.cap, (review, count) =>
			self.postMessage({ review, count }),
		);
		self.postMessage({ done: true });
	} catch {
		self.postMessage({ error: true });
	}
};
