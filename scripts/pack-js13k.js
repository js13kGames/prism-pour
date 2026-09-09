import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { zipJs13k } from './zip-js13k.js';
import { minify } from 'html-minifier-terser';
import { Packer } from 'roadroller';
import { runInNewContext } from 'node:vm';

const optimizationLevel = Number(
	process.argv.find((arg) => arg.startsWith('--level='))?.split('=')[1] ?? 2,
);
const trial = process.argv.find((arg) => arg.startsWith('--trial='))?.split('=')[1] ?? '';
if (![1, 2].includes(optimizationLevel) || (trial && !/^[a-z0-9-]+$/.test(trial)))
	throw new Error('Use --level=1 or --level=2, and an optional alphanumeric --trial=name.');

const inputDirectory = 'dist-js13k';
const outputDirectory = `dist-js13k-packed${trial ? '-' + trial : ''}`;
const archive = `dist-js13k${trial ? '-' + trial : ''}.zip`;
const inputHtml = await readFile(`${inputDirectory}/index.html`, 'utf8');
const scriptSource = inputHtml.match(
	/<script type="module" crossorigin src="([^"]+)"><\/script>/,
)?.[1];
const styleSource = inputHtml.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)?.[1];

if (!scriptSource || !styleSource)
	throw new Error('JS13K build is missing its main script or stylesheet.');

const [script, style] = await Promise.all([
	readFile(`${inputDirectory}/${scriptSource.replace('./', '')}`, 'utf8'),
	readFile(`${inputDirectory}/${styleSource.replace('./', '')}`, 'utf8'),
]);
const inlinedHtml = inputHtml
	.replace(
		/<script type="module" crossorigin src="[^"]+"><\/script>/,
		`<script type="module">${script}</script>`,
	)
	.replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, `<style>${style}</style>`);
const minifiedHtml = await minify(inlinedHtml, {
	collapseBooleanAttributes: true,
	collapseWhitespace: true,
	minifyCSS: true,
	removeAttributeQuotes: true,
	removeComments: true,
	removeRedundantAttributes: true,
	removeScriptTypeAttributes: true,
	removeStyleLinkTypeAttributes: true,
	useShortDoctype: true,
});
const packer = new Packer([{ data: minifiedHtml, type: 'text', action: 'write' }], {
	allowFreeVars: true,
});
let lastProgress = 0;
const optimization = await packer.optimize(optimizationLevel, (progress) => {
	if (Date.now() - lastProgress > 15000) {
		console.log(`Optimizing ${progress.pass}: best estimate ${progress.bestSize} bytes`);
		lastProgress = Date.now();
	}
});
const { firstLine, secondLine } = packer.makeDecoder();
let decoded = '';
try {
	runInNewContext(
		firstLine + secondLine,
		{
			TextDecoder,
			document: {
				write: (html) => {
					decoded += html;
				},
			},
		},
		{ timeout: 30000 },
	);
} catch (error) {
	throw new Error(`Decoder verification failed: ${error.message}`);
}
if (decoded !== minifiedHtml) throw new Error('Roadroller round-trip verification failed.');

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(`${outputDirectory}/assets`, { recursive: true });
await writeFile(`${outputDirectory}/index.html`, `<script>${firstLine}${secondLine}</script>`);

const assets = await readdir(`${inputDirectory}/assets`);
await Promise.all(
	assets
		.filter((asset) => asset.includes('-worker-') && asset.endsWith('.js'))
		.map((asset) => cp(`${inputDirectory}/assets/${asset}`, `${outputDirectory}/assets/${asset}`)),
);

await zipJs13k(outputDirectory, archive);

console.log(`Roadroller entry: ${(await stat(`${outputDirectory}/index.html`)).size} bytes`);
console.log(`JS13K ZIP: ${(await stat(archive)).size} bytes`);
console.log(`Optimization: ${JSON.stringify(optimization)}`);
await writeFile(
	`${outputDirectory}-tuning.json`,
	JSON.stringify({ level: optimizationLevel, ...optimization, options: packer.options }, null, 2),
);
