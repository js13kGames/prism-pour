import { registerSW } from 'virtual:pwa-register';

let resolveRegistration;
const registrationReady = new Promise((resolve) => {
	resolveRegistration = resolve;
});

const waitFor = (promise, milliseconds) =>
	Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), milliseconds))]);

const activateUpdate = registerSW({
	immediate: true,
	onNeedReload() {
		// This callback only runs after updateBetweenLevels chooses to activate a waiting worker.
		window.location.reload();
	},
	onRegisteredSW(_serviceWorkerUrl, serviceWorkerRegistration) {
		resolveRegistration(serviceWorkerRegistration);
	},
});

export function downloadUpdate() {
	registrationReady
		.then((serviceWorkerRegistration) => serviceWorkerRegistration.update())
		.catch(() => {});
}

export async function updateBetweenLevels() {
	if (!navigator.onLine) return false;

	const serviceWorkerRegistration = await waitFor(registrationReady, 1_500);
	if (!serviceWorkerRegistration) return false;

	await waitFor(
		serviceWorkerRegistration.update().catch(() => null),
		1_800,
	);

	if (serviceWorkerRegistration.installing) {
		await waitFor(
			new Promise((resolve) => {
				const worker = serviceWorkerRegistration.installing;
				worker.addEventListener('statechange', () => {
					if (['installed', 'redundant'].includes(worker.state)) resolve(true);
				});
			}),
			6_000,
		);
	}

	if (!serviceWorkerRegistration.waiting) return false;

	// Workbox only receives SKIP_WAITING at the safe between-level boundary.
	await activateUpdate(true);
	return true;
}

const install = document.querySelector('#install');
let installPrompt = null;

addEventListener('beforeinstallprompt', (event) => {
	event.preventDefault();
	installPrompt = event;
	install.textContent = 'Install Prism Pour';
	install.hidden = false;
});

addEventListener('appinstalled', () => {
	installPrompt = null;
	install.hidden = true;
});

install.onclick = async () => {
	if (installPrompt) {
		const prompt = installPrompt;
		installPrompt = null;
		await prompt.prompt();
		const result = await prompt.userChoice;

		if (result.outcome === 'accepted') install.hidden = true;
		return;
	}

	document.querySelector('#install-help').hidden = false;
};

if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
	install.hidden = true;
}
