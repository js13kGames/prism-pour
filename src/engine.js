export const CAP = 4;
export const MAX_LEVEL = 100000;
export const isDeepLevel = (level) => level > 0 && level % 10 === 0;
export const capacity = (level) => (isDeepLevel(level) ? 8 : CAP);
export const colorCount = (level) =>
	isDeepLevel(level) ? 3 : Math.min(12, 4 + Math.floor((level - 1) / 4));
export const clone = (b) => b.map((t) => t.slice());
export const complete = (t, cap = CAP) => t.length === cap && t.every((c) => c === t[0]);
export const won = (b, cap = CAP) => b.every((t) => !t.length || complete(t, cap));
export function move(b, a, z, cap = CAP) {
	if (a === z || !b[a]?.length || !b[z] || b[z].length === cap) return null;
	let c = b[a].at(-1);
	if (b[z].length && b[z].at(-1) !== c) return null;
	let n = 0;
	for (let j = b[a].length - 1; j >= 0 && b[a][j] === c; j--) n++;
	n = Math.min(n, cap - b[z].length);
	let next = clone(b);
	next[a].splice(-n);
	next[z].push(...Array(n).fill(c));
	return { board: next, count: n, color: c };
}
export function generate(level, count = colorCount(level), cap = capacity(level), emptyTubes = 2) {
	let seed = (level * 1234567 + 89123) >>> 0;
	const rnd = () => {
		seed ^= seed << 13;
		seed ^= seed >>> 17;
		seed ^= seed << 5;
		return (seed >>> 0) / 4294967296;
	};
	const colors = count;
	let best;
	for (let attempt = 0; attempt < 30; attempt++) {
		let b = Array.from({ length: colors }, (_, c) => Array(cap).fill(c));
		b.push(...Array.from({ length: emptyTubes }, () => []));
		let undo = [];
		for (let k = 0; k < Math.min(180, 35 + level * 4); k++) {
			let options = [];
			for (let a = 0; a < b.length; a++) {
				if (!b[a].length) continue;
				let c = b[a].at(-1),
					run = 0;
				for (let i = b[a].length - 1; i >= 0 && b[a][i] === c; i--) run++;
				for (let z = 0; z < b.length; z++) {
					if (a === z || b[z].length === cap || b[z].at(-1) === c) continue;
					for (let n = 1; n <= Math.min(run, cap - b[z].length); n++) {
						if (b[a].length - n === 0 || b[a][b[a].length - n - 1] === c) options.push([a, z, n]);
					}
				}
			}
			if (!options.length) break;
			let [a, z, n] = options[Math.floor(rnd() * options.length)];
			b[z].push(...b[a].splice(-n));
			undo.unshift([z, a]);
		}
		let score = b.reduce((s, t) => s + t.slice(1).filter((c, i) => c !== t[i]).length, 0);
		if (!best || score > best.score) best = { board: b, score, solution: undo };
	}
	return best;
}
