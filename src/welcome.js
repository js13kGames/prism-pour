const WELCOME_KEY = 'prism-pour-welcome-seen';

export function installWelcome({ dialog, play, close, debug, settle, onDismiss, storage }) {
	let fromDebug = false;
	function open() {
		settle();
		dialog.showModal();
	}
	play.onclick = close.onclick = () => dialog.close();
	dialog.addEventListener('close', () => {
		try {
			storage().setItem(WELCOME_KEY, 'true');
		} catch {}
		if (fromDebug) debug.focus();
		else onDismiss();
	});
	debug.onclick = () => {
		fromDebug = true;
		open();
	};
	let seen = false;
	try {
		seen = storage().getItem(WELCOME_KEY) === 'true';
	} catch {}
	if (!seen) open();
	return !seen;
}
