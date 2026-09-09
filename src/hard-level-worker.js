import { searchHardLevels } from './hard-levels.js';
self.onmessage = ({ data }) => {
	try {
		let lastReport = 0,
			bestScore = -Infinity;
		const result = searchHardLevels(data.options, {
			seconds: data.seconds,
			report: (progress) => {
				const score = progress.best?.score ?? -Infinity;
				if (score > bestScore || Date.now() - lastReport >= 250) {
					self.postMessage(progress);
					lastReport = Date.now();
					bestScore = score;
				}
			},
		});
		self.postMessage({ ...result, done: true });
	} catch (error) {
		self.postMessage({ error: error.message });
	}
};
