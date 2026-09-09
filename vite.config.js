import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	base: './',
	plugins: [
		VitePWA({
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
		outDir: 'dist',
		assetsDir: 'assets',
	},
});
