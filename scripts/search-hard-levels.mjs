import { appendFileSync } from 'node:fs';
import { searchHardLevels } from '../src/hard-levels.js';

const args = Object.fromEntries(
	process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const options = {
	seed: Number(args.seed ?? 1),
	colors: Number(args.colors ?? 4),
	capacity: Number(args.capacity ?? 4),
	emptyTubes: Number(args.emptyTubes ?? 1),
};
const output = args.output ?? 'hard-levels.jsonl';
searchHardLevels(options, {
	seconds: Number(args.seconds ?? 28800),
	candidates: Number(args.candidates ?? 10000),
	maxVisits: Number(args.maxVisits ?? 15000),
	report: (progress, candidate) => {
		if (candidate) appendFileSync(output, JSON.stringify(candidate) + '\n');
		console.error(
			JSON.stringify({
				attempted: progress.attempted,
				proven: progress.proven,
				nextSeed: progress.nextSeed,
				bestScore: progress.best?.score,
			}),
		);
	},
});
