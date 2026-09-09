import { registerSW } from 'virtual:pwa-register';

let registration = null;
let updateRequest = null;
let reloadAtLevelBoundary = false;

const activateUpdate = registerSW({
	immediate: true,
	onNeedReload() {
		// An external tab can also change the controlling worker. Never reload
		// this page unless this player has chosen to leave the current level.
		if (reloadAtLevelBoundary) window.location.reload();
	},
	onRegisteredSW(_serviceWorkerUrl, serviceWorkerRegistration) {
		registration = serviceWorkerRegistration ?? null;
		downloadUpdate();
	},
});

export function downloadUpdate() {
	if (!registration || !navigator.onLine || updateRequest) return;
	updateRequest = Promise.resolve()
		.then(() => registration.update())
		.catch(() => {})
		.finally(() => {
			updateRequest = null;
		});
}

addEventListener('online', downloadUpdate);

export async function updateBetweenLevels() {
	// Snapshot readiness now. Registration, network checks, and downloads
	// must never delay a level; a later download can activate next time.
	if (!registration?.waiting) return false;

	// Workbox only receives SKIP_WAITING at the safe between-level boundary.
	reloadAtLevelBoundary = true;
	try {
		await activateUpdate(true);
		return true;
	} catch {
		reloadAtLevelBoundary = false;
		return false;
	}
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
