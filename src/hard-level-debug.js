// Browser adapter; the search itself lives in hard-levels.js.
export function installHardLevelDebug(readOptions, play) {
	const $ = (id) => document.getElementById(id);
	let worker = null,
		best = null,
		runningOptions;
	function stop() {
		worker?.terminate();
		worker = null;
		$('hard-start').disabled = false;
		$('hard-stop').disabled = true;
	}
	$('hard-start').onclick = () => {
		stop();
		best = null;
		$('hard-play').disabled = true;
		$('hard-export').disabled = true;
		runningOptions = readOptions();
		$('hard-status').textContent = 'Searching and proving solutions…';
		const current = new Worker(new URL('./hard-level-worker.js', import.meta.url), {
			type: 'module',
		});
		worker = current;
		$('hard-start').disabled = true;
		$('hard-stop').disabled = false;
		current.onmessage = ({ data }) => {
			if (worker !== current) return;
			if (data.error) {
				$('hard-status').textContent = data.error;
				stop();
				return;
			}
			best = data.best;
			$('hard-play').disabled = !best;
			$('hard-export').disabled = !best;
			$('hard-status').textContent =
				`${data.done ? 'Finished' : 'Searching'}: ${data.attempted} candidates, ${data.proven} proven.` +
				(best
					? ` Best seed ${best.options.seed}: ${best.metrics.minimum} moves, score ${best.score.toFixed(1)}. Dead ends: ${best.metrics.deadEnds}/${best.metrics.sampled} sampled detours; ${best.metrics.unknown} unresolved.`
					: ' No proven candidate yet. Try fewer colors or slots.');
			if (data.done) stop();
		};
		current.onerror = () => {
			$('hard-status').textContent = 'Search failed. Try a smaller puzzle.';
			stop();
		};
		current.postMessage({ options: runningOptions, seconds: Number($('hard-seconds').value) });
	};
	$('hard-stop').onclick = () => {
		stop();
		$('hard-status').textContent += ' Stopped; best result kept.';
	};
	$('debug-dialog').addEventListener('close', stop);
	$('hard-play').onclick = () => {
		if (best) {
			stop();
			play({ ...best.options, hiddenColors: runningOptions.hiddenColors }, best.board);
		}
	};
	$('hard-export').onclick = () => {
		if (!best) return;
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(best, null, 2)], { type: 'application/json' }),
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `prism-hard-${best.options.seed}.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};
}
