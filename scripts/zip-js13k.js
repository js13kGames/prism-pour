import advzip from 'advzip-bin';
import { execFile } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function zipJs13k(directory, archive) {
	const root = resolve(directory);
	const destination = resolve(archive);
	async function files(relative = '') {
		const entries = await readdir(join(root, relative), { withFileTypes: true });
		const paths = await Promise.all(
			entries.map((entry) => {
				const path = relative ? `${relative}/${entry.name}` : entry.name;
				return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
			}),
		);
		return paths.flat().sort();
	}
	const entries = await files();
	if (!entries.includes('index.html')) throw new Error('Missing packed index.html');
	// Remove only the exact generated ZIP; never touch the input tree.
	if (
		!destination.endsWith('.zip') ||
		entries.some((entry) => resolve(root, entry) === destination)
	)
		throw new Error('Archive must be a .zip outside the input files');
	await rm(destination, { force: true });
	await run(advzip, ['--add', '--shrink-insane', '--iter=100', destination, ...entries], {
		cwd: root,
		windowsHide: true,
	});
	await run(advzip, ['--test', '--pedantic', destination], { windowsHide: true });
}
