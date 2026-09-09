import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
	const js13k = mode === 'js13k';

	return {
		base: './',
		resolve: {
			alias: {
				'js13k-solver': fileURLToPath(
					new URL(`./src/${js13k ? 'main-thread-solver.js' : 'empty-solver.js'}`, import.meta.url),
				),
				'solver-worker-url': fileURLToPath(
					new URL(
						`./src/${js13k ? 'empty-worker-url.js' : 'solver-worker-url.js'}`,
						import.meta.url,
					),
				),
			},
		},
		define: {
			__JS13K__: JSON.stringify(js13k),
		},
		css: {
			postcss: {
				plugins: js13k
					? [
							{
								postcssPlugin: 'js13k-without-debug-styles',
								Once(root) {
									root.walkRules((rule) => {
										if (/debug|unlock-all/.test(rule.selector)) rule.remove();
									});
								},
							},
						]
					: [],
			},
		},
		plugins: [
			...(js13k
				? [
						{
							name: 'js13k-without-debug-menu',
							transformIndexHtml(html) {
								return html
									.replace(/<button id="debug"[\s\S]*?<\/button>/, '')
									.replace(/<dialog id="debug-dialog"[\s\S]*?<\/dialog>/, '');
							},
						},
					]
				: []),
			VitePWA({
				disable: js13k,
				registerType: 'prompt',
				injectRegister: false,
				includeAssets: ['icons/apple-touch-icon.png'],
				manifest: {
					name: 'Prism Pour',
					short_name: 'Prism Pour',
					description: 'A little moment of flow. Glossy marble puzzles, without ads.',
					start_url: './',
					scope: './',
					display: 'standalone',
					background_color: '#0c1026',
					theme_color: '#0c1026',
					icons: [
						{
							src: 'icons/icon-192.png',
							sizes: '192x192',
							type: 'image/png',
							purpose: 'any',
						},
						{
							src: 'icons/icon-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any',
						},
					],
				},
				workbox: {
					clientsClaim: false,
					globPatterns: ['**/*.{js,wasm,css,html,webp}'],
					skipWaiting: false,
				},
			}),
		],
		build: {
			outDir: js13k ? 'dist-js13k' : 'dist',
			assetsDir: 'assets',
			target: js13k ? 'esnext' : undefined,
			minify: js13k ? 'terser' : undefined,
			terserOptions: js13k
				? {
						compress: { passes: 3 },
						mangle: { toplevel: true },
						module: true,
						toplevel: true,
					}
				: undefined,
		},
	};
});
