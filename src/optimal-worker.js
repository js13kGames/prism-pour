import { optimal } from './optimal.js';
self.onmessage = ({ data }) => {
	try {
		optimal(data.board, (result) => self.postMessage(result), data.cap);
	} catch {
		self.postMessage({ error: true });
	}
};
