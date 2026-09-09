import './style.css';
import { reviewLayout, reviewArrow } from './review-layout.js';
import { installWelcome } from './welcome.js';
import { installHardLevelDebug } from './hard-level-debug.js';
import { downloadUpdate, updateBetweenLevels } from './pwa.js';
import {
	generate,
	clone,
	complete,
	won,
	move,
	capacity,
	colorCount,
	isDeepLevel,
	MAX_LEVEL,
} from './engine.js';
const $ = (s) => document.querySelector(s),
	colors = [
		'#ff9fbe',
		'#00e5dc',
		'#9b59f5',
		'#ffe13b',
		'#69bfff',
		'#b2ed36',
		'#ff8824',
		'#f5f1e8',
		'#ed3545',
		'#139b56',
		'#354dcc',
		'#ef35bb',
	],
	names = [
		'rose',
		'aqua',
		'violet',
		'gold',
		'blue',
		'lime',
		'orange',
		'pearl',
		'ruby',
		'jade',
		'indigo',
		'magenta',
	];
const icons = {
	undo: '<path d="M9 5 3 11l6 6M3 11h11a7 7 0 0 1 0 14" transform="translate(1 -3)"/>',
	restart: '<path d="M20 10a8 8 0 1 1-5-6M15 1v5h5"/>',
	extra: '<path d="M12 4v16M4 12h16"/>',
	debug: '<path d="M8 5 3 12l5 7M16 5l5 7-5 7M14 4l-4 16"/>',
	settings:
		'<path d="m9 3 1-2h4l1 2 2 1 2 0 2 3-1 2v3l1 2-2 3-2 0-2 1-1 3h-4l-1-3-2-1H5l-2-3 1-2V9L3 7l2-3h2Z"/><circle cx="12" cy="11" r="3"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]}</svg>`;
$('#settings').innerHTML = icon('settings');
['undo', 'restart', 'extra', 'debug'].forEach((n) => ($('#' + n + ' .circle').innerHTML = icon(n)));
let level = 1,
	board = [],
	marbleIds = [],
	knownMarbles = new Set(),
	nextMarbleId = 0,
	history = [],
	selected = -1,
	moves = 0,
	sound = true,
	numberedMarbles = false,
	extra = false,
	audio;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let startBoard = null,
	replayMoves = [];
let unlocked = 1,
	allUnlocked = false,
	debugUnlocked = false,
	customLevel = null,
	completed = new Set(),
	perfectLevels = new Set(),
	sessions = {},
	levelPage = 0;
const validLevel = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL;
const activeCapacity = () => customLevel?.capacity ?? capacity(level);
const tubeHeight = (cap = activeCapacity()) => 42 + cap * 38;
function validBoard(b, l) {
	const cap = capacity(l);
	if (!Array.isArray(b) || b.length < 6 || b.length > 14) return false;
	const counts = Array(12).fill(0);
	if (
		!b.every(
			(t) =>
				Array.isArray(t) &&
				t.length <= cap &&
				t.every((c) => Number.isInteger(c) && c >= 0 && c < colorCount(l)),
		)
	)
		return false;
	b.flat().forEach((c) => counts[c]++);
	const n = counts.filter(Boolean).length;
	return (
		n >= Math.min(4, colorCount(l)) &&
		n <= colorCount(l) &&
		counts.every((c) => c === 0 || c === cap) &&
		b.length >= n + 2 &&
		b.length <= n + 3
	);
}
try {
	const s = JSON.parse(localStorage.getItem('prism-pour'));
	if (s && validLevel(s.level)) {
		replayMoves = Array.isArray(s.replayMoves) ? s.replayMoves : null;
		level = s.level;
		if (typeof s.sound === 'boolean') sound = s.sound;
		numberedMarbles = s.numberedMarbles === true;
		unlocked = Math.max(level, validLevel(s.unlocked) ? s.unlocked : level);
		allUnlocked = s.allUnlocked === true;
		debugUnlocked = s.debugUnlocked === true;
		completed = new Set(
			Array.isArray(s.completed)
				? s.completed.filter(validLevel)
				: Array.from({ length: level - 1 }, (_, i) => i + 1),
		);
		perfectLevels = new Set(
			Array.isArray(s.perfectLevels)
				? s.perfectLevels.filter((n) => validLevel(n) && completed.has(n))
				: [],
		);
		if (s.sessions && typeof s.sessions === 'object' && !Array.isArray(s.sessions))
			sessions = s.sessions;
		if (validBoard(s.board, level)) {
			board = clone(s.board);
			startBoard = validBoard(s.startBoard, level)
				? clone(s.startBoard)
				: generate(level, new Set(board.flat()).size).board;
			moves = Number.isInteger(s.moves) && s.moves >= 0 ? s.moves : 0;
			extra = board.length > new Set(board.flat()).size + 2;
		}
	}
} catch {}
if (!board.length) board = generate(level).board;
if (!startBoard) startBoard = clone(board);
function assignMarbleIds(b) {
	return b.map((tube) => tube.map(() => nextMarbleId++));
}
function revealTopMarbles() {
	if (!customLevel?.hiddenColors) return;
	marbleIds.forEach((tube) => {
		if (tube.length) knownMarbles.add(tube.at(-1));
	});
}
marbleIds = assignMarbleIds(board);
function save() {
	if (!customLevel)
		sessions[level] = {
			board: clone(board),
			startBoard: clone(startBoard),
			moves,
			extra,
			replayMoves,
		};
	try {
		localStorage.setItem(
			'prism-pour',
			JSON.stringify({
				level,
				board: customLevel ? (sessions[level]?.board ?? null) : board,
				startBoard: customLevel ? (sessions[level]?.startBoard ?? null) : startBoard,
				replayMoves: customLevel ? (sessions[level]?.replayMoves ?? null) : replayMoves,
				moves: customLevel ? (sessions[level]?.moves ?? 0) : moves,
				sound,
				numberedMarbles,
				unlocked,
				allUnlocked,
				debugUnlocked,
				completed: [...completed],
				perfectLevels: [...perfectLevels],
				sessions,
			}),
		);
	} catch {}
}
function recordWin() {
	if (!customLevel && won(board, activeCapacity())) {
		completed.add(level);
		if (minimumCalculation?.result?.exact && moves === minimumCalculation.result.minimum)
			perfectLevels.add(level);
		unlocked = Math.max(unlocked, Math.min(MAX_LEVEL, level + 1));
	}
}
function tone(freq = 500, duration = 0.12) {
	if (!sound) return;
	try {
		audio ??= new (window.AudioContext || window.webkitAudioContext)();
		audio.resume();
		let o = audio.createOscillator(),
			g = audio.createGain();
		o.type = 'sine';
		o.frequency.setValueAtTime(freq, audio.currentTime);
		o.frequency.exponentialRampToValueAtTime(freq * 0.7, audio.currentTime + duration);
		g.gain.setValueAtTime(0.065, audio.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
		o.connect(g);
		g.connect(audio.destination);
		o.start();
		o.stop(audio.currentTime + duration);
	} catch {}
}
function vibrate(n) {
	if (!reduced) navigator.vibrate?.(n);
}
// Flights are visual only. The board and history commit synchronously on every move.
const flights = new Set();
let winTimer = 0;
function cancelWin() {
	clearTimeout(winTimer);
	winTimer = 0;
}
function finishFlight(f) {
	if (!flights.delete(f)) return;
	f.animation?.cancel();
	f.el?.remove();
	const marble = $(`[data-i="${f.to}"] [data-slot="${f.slot}"]`);
	if (marble) {
		marble.style.opacity = '1';
		if (!reduced)
			marble.animate(
				[
					{ transform: 'scale(1.16,.84)' },
					{ transform: 'scale(.96,1.04)' },
					{ transform: 'scale(1)' },
				],
				{ duration: 140, easing: 'ease-out' },
			);
	}
}
function settleFlights(tube) {
	for (const f of [...flights])
		if (tube === undefined || f.from === tube || f.to === tube) finishFlight(f);
}
function marbleSVG(c, id, concealed = false) {
	const marbleColor = concealed ? '#5f6688' : colors[c];
	return `<svg viewBox="0 0 44 44" aria-hidden="true"><defs>
  <radialGradient id="ball${id}" cx="32%" cy="24%" r="78%"><stop stop-color="#fff"/><stop offset=".15" stop-color="${marbleColor}"/><stop offset=".6" stop-color="${marbleColor}"/><stop offset="1" stop-color="#17183b"/></radialGradient>
  </defs><circle cx="22" cy="22" r="20" fill="url(#ball${id})" stroke="${marbleColor}" stroke-width=".8"/>
  <ellipse cx="15" cy="12" rx="6" ry="3.2" transform="rotate(-32 15 12)" fill="#fff" opacity=".75"/>
  <path d="M29 36Q36 33 38 26" fill="none" stroke="${marbleColor}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="29" cy="13" r="1.8" fill="#fff" opacity=".45"/>${concealed ? '<text x="22" y="28" text-anchor="middle" fill="#f5f3ff" font-family="sans-serif" font-size="20" font-weight="700">?</text>' : numberedMarbles ? `<text x="22" y="29" text-anchor="middle" fill="#fff" stroke="#10152e" stroke-width="3" paint-order="stroke" font-family="sans-serif" font-size="21" font-weight="800">${c + 1}</text>` : ''}</svg>`;
}
function marbleIsConcealed(tube, slot, tubeId) {
	if (!customLevel?.hiddenColors) return false;
	const marbleId = Number.isInteger(tubeId) ? marbleIds[tubeId]?.[slot] : undefined;
	return marbleId === undefined ? slot < tube.length - 1 : !knownMarbles.has(marbleId);
}
function tubeContents(t, tubeId) {
	return t.map((c, i) => (marbleIsConcealed(t, i, tubeId) ? 'hidden marble' : names[c])).join(', ');
}
function tubeSVG(t, id) {
	const height = tubeHeight(),
		bottom = height - 15,
		innerBottom = height - 42,
		outerBottom = height - 7;
	let segments = t
		.map((c, i) => {
			const inFlight = [...flights].some((f) => f.to === id && f.slot === i),
				concealed = marbleIsConcealed(t, i, id);
			return `<g class="marble" data-slot="${i}" style="opacity:${inFlight ? 0 : 1}"><ellipse cx="41" cy="${bottom - i * 38}" rx="17" ry="3" fill="#02061455"/><svg x="19" y="${bottom - 44 - i * 38}" width="44" height="44">${marbleSVG(c, `${id}-${i}`, concealed)}</svg></g>`;
		})
		.join('');
	return `<svg viewBox="0 0 82 ${height}" aria-hidden="true"><defs><linearGradient id="glass${id}"><stop stop-color="#e1eaff88"/><stop offset=".1" stop-color="#d3deff0a"/><stop offset=".5" stop-color="#cce1ff02"/><stop offset=".85" stop-color="#bacaff15"/><stop offset="1" stop-color="#dce5ff77"/></linearGradient></defs><path d="M9 10H73V${innerBottom}Q73 ${outerBottom} 41 ${outerBottom}Q9 ${outerBottom} 9 ${innerBottom}Z" fill="url(#glass${id})" stroke="#c7d3f4aa" stroke-width="1.5"/>${segments}<path d="M13 15V${innerBottom - 1}Q13 ${outerBottom - 6} 40 ${outerBottom - 4}" fill="none" stroke="#fff9" stroke-width="2"/><path d="M69 17V${innerBottom - 2}Q69 ${outerBottom - 12} 57 ${outerBottom - 8}" fill="none" stroke="#c9d8ff88" stroke-width="2"/><path d="M18 21V${innerBottom - 13}" stroke="#fff4" stroke-width="3" stroke-linecap="round"/><ellipse cx="41" cy="10" rx="32" ry="5" fill="#13183077" stroke="#f3f2ffe0" stroke-width="1.5"/><ellipse cx="41" cy="11" rx="28" ry="3" fill="none" stroke="#b3c4ef88"/></svg>`;
}
function render() {
	revealTopMarbles();
	let container = $('#board');
	container.classList.toggle('many', board.length > 6);
	container.classList.toggle('large', board.length > 10);
	const resized = container.childElementCount !== board.length;
	if (resized)
		container.innerHTML = board
			.map((_, i) => `<button class="tube" data-i="${i}"></button>`)
			.join('');
	container.querySelectorAll('.tube').forEach((el, i) => {
		const t = board[i],
			signature =
				Number(numberedMarbles) +
				'|' +
				t.join(',') +
				'|' +
				[...flights]
					.filter((f) => f.to === i)
					.map((f) => f.slot)
					.join(',');
		if (el.dataset.signature !== signature) {
			el.innerHTML = tubeSVG(t, i);
			el.dataset.signature = signature;
		}
		el.classList.toggle('done', complete(t, activeCapacity()));
		el.setAttribute(
			'aria-label',
			`Tube ${i + 1}: ${t.length ? tubeContents(t, i) + ', bottom to top' : 'empty'}${complete(t, activeCapacity()) ? ', sorted' : ''}`,
		);
	});
	renderSelection();
	if (resized) fitBoard();
	$('#level').textContent = customLevel
		? `DEBUG · SEED ${customLevel.seed}`
		: 'LEVEL ' + String(level).padStart(2, '0') + (isDeepLevel(level) ? ' · DEEP POUR' : '');
	$('#moves').textContent = moves;
	$('#sorted').textContent =
		board.filter((tube) => complete(tube, activeCapacity())).length +
		' of ' +
		generateCount() +
		' sorted';
	$('#undo').disabled = !history.length;
	$('#extra').disabled = extra || board.length >= 14;
	$('#sound-toggle').checked = sound;
	$('#numbered-marbles').checked = numberedMarbles;
}
function generateCount() {
	return new Set(board.flat()).size;
}
function flyMarbles(a, i, result, sourceLength, destLength, from, to, sourceLift = 0) {
	if (reduced) return;
	for (let j = 0; j < result.count; j++) {
		const slot = destLength + j;
		const size = (44 * from.width) / 82;
		const x = from.left + from.width / 2 - size / 2;
		const y =
			from.top + ((tubeHeight() - 59 - (sourceLength - 1 - j) * 38 - sourceLift) * from.width) / 82;
		const dx = to.left + to.width / 2 - size / 2 - x;
		const dy = to.top + ((tubeHeight() - 59 - slot * 38) * to.width) / 82 - y;
		const el = document.createElement('div');
		el.className = 'flying-marble';
		el.innerHTML = marbleSVG(result.color, `flight-${moves}-${j}`);
		el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;color:${colors[result.color]}`;
		document.body.append(el);
		const f = { from: a, to: i, slot, el, animation: null };
		flights.add(f);
		const lift = Math.min(70, 24 + Math.abs(dx) * 0.14);
		f.animation = el.animate(
			[
				{ transform: 'translate(0,0) scale(1)', offset: 0 },
				{
					transform: `translate(${dx * 0.48}px,${Math.min(0, dy) - lift}px) scale(1.08,.92)`,
					offset: 0.45,
				},
				{ transform: `translate(${dx}px,${dy}px) scale(.96,1.04)`, offset: 1 },
			],
			{ duration: 190, delay: j * 18, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' },
		);
		f.animation.finished.then(
			() => finishFlight(f),
			() => finishFlight(f),
		);
	}
}
function choose(i) {
	if (won(board, activeCapacity())) return;
	if (selected < 0) {
		if (!board[i].length) return;
		settleFlights(i);
		selected = i;
		tone(570, 0.055);
		vibrate(6);
		renderSelection();
		return;
	}
	if (selected === i) {
		selected = -1;
		renderSelection();
		return;
	}
	const a = selected,
		result = move(board, a, i, activeCapacity());
	if (!result) {
		selected = board[i].length ? i : selected;
		settleFlights(i);
		renderSelection();
		$(`[data-i="${i}"]`).classList.add('shake');
		$('#message').textContent = 'Match the top marble, or use an empty tube.';
		tone(160, 0.07);
		return;
	}
	cancelWin();
	settleFlights(a);
	settleFlights(i);
	const from = $(`[data-i="${a}"]`).getBoundingClientRect(),
		to = $(`[data-i="${i}"]`).getBoundingClientRect();
	const sourceLength = board[a].length,
		destLength = board[i].length;
	let sourceRun = 0;
	for (let j = sourceLength - 1; j >= 0 && board[a][j] === board[a].at(-1); j--) sourceRun++;
	const sourceLift = tubeHeight() - 12 - (sourceLength - sourceRun) * 38;
	history.push({
		board: clone(board),
		marbleIds: clone(marbleIds),
		moves,
		extra,
		replayLength: replayMoves?.length,
	});
	replayMoves?.push([a, i]);
	const movedMarbles = marbleIds[a].splice(-result.count);
	if (customLevel?.hiddenColors) movedMarbles.forEach((marbleId) => knownMarbles.add(marbleId));
	marbleIds[i].push(...movedMarbles);
	board = result.board;
	moves++;
	selected = -1;
	flyMarbles(a, i, result, sourceLength, destLength, from, to, sourceLift);
	recordWin();
	render();
	save();
	tone(660 + result.count * 45, 0.09);
	vibrate(8);
	$('#message').textContent = 'Tap a tube, then tap another to move marbles.';
	if (complete(board[i], activeCapacity())) {
		burst(to.left + to.width / 2, to.top + to.height * 0.45, 18);
		tone(990, 0.17);
		$('#message').textContent = 'One color. Perfect harmony.';
	}
	if (won(board, activeCapacity()))
		winTimer = setTimeout(
			() => {
				winTimer = 0;
				if (won(board, activeCapacity())) celebrate();
			},
			reduced ? 0 : 260,
		);
}
function celebrate() {
	downloadUpdate();
	showMinimum();
	recordWin();
	save();
	$('#next').textContent = customLevel
		? 'Back to debug'
		: level === MAX_LEVEL
			? 'Choose a level'
			: 'Next level →';
	$('#win-text').textContent =
		`Level ${level} complete in ${moves} moves. Take a breath. Enjoy the little win.`;
	if (!$('#win-dialog').open) $('#win-dialog').showModal();
	if (!reduced) {
		burst(innerWidth * 0.3, innerHeight * 0.4, 70);
		burst(innerWidth * 0.7, innerHeight * 0.4, 70);
	}
}
function reset() {
	stopMinimum();
	cancelWin();
	settleFlights();
	board = customLevel
		? generate(customLevel.seed, customLevel.colors, customLevel.capacity, customLevel.emptyTubes)
				.board
		: generate(level).board;
	marbleIds = assignMarbleIds(board);
	knownMarbles = new Set();
	startBoard = clone(board);
	history = [];
	replayMoves = [];
	moves = 0;
	extra = false;
	selected = -1;
	render();
	save();
	startMinimumCalculation();
	$('#message').textContent = 'Tap a tube, then tap another to move marbles.';
}
$('#undo').onclick = () => {
	if (!history.length) return;
	cancelWin();
	settleFlights();
	let s = history.pop();
	board = s.board;
	marbleIds = s.marbleIds ?? assignMarbleIds(board);
	moves = s.moves;
	extra = s.extra;
	if (replayMoves) replayMoves.length = s.replayLength;
	selected = -1;
	render();
	save();
	startMinimumCalculation();
	tone(390);
};
$('#restart').onclick = () => reset();
$('#extra').onclick = () => {
	if (extra || board.length >= 14) return;
	cancelWin();
	settleFlights();
	history.push({
		board: clone(board),
		marbleIds: clone(marbleIds),
		moves,
		extra,
		replayLength: replayMoves?.length,
	});
	replayMoves?.push('extra');
	board.push([]);
	marbleIds.push([]);
	extra = true;
	selected = -1;
	render();
	save();
	startMinimumCalculation();
	$('#message').textContent = 'A little breathing room. Always free.';
	tone(780);
};
$('#sound-toggle').onchange = (e) => {
	sound = e.target.checked;
	save();
	tone(720);
};
$('#numbered-marbles').onchange = (e) => {
	numberedMarbles = e.target.checked;
	settleFlights();
	render();
	save();
};
$('#settings').onclick = () => {
	settleFlights();
	$('#settings-dialog').showModal();
};
$('#got-it').onclick = $('#settings-dialog .close').onclick = () => $('#settings-dialog').close();
$('#next').onclick = () => {
	if (customLevel) {
		$('#win-dialog').close();
		$('#debug-dialog').showModal();
		return;
	}
	if (level === MAX_LEVEL) {
		$('#win-dialog').close();
		openLevels();
		return;
	}
	changeLevel(level + 1);
};
$('#replay').onclick = () => {
	$('#win-dialog').close();
	reset();
};
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		selected = -1;
		render();
	}
	if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !document.querySelector('dialog[open]')) {
		e.preventDefault();
		$('#undo').click();
	}
});

function switchLevel(n) {
	if (!validLevel(n) || (!allUnlocked && n > unlocked)) return false;
	stopMinimum();
	cancelWin();
	settleFlights();
	save();
	customLevel = null;
	level = n;
	history = [];
	selected = -1;
	const saved = sessions[n];
	if (saved && validBoard(saved.board, n)) {
		replayMoves = Array.isArray(saved.replayMoves) ? saved.replayMoves : null;
		board = clone(saved.board);
		startBoard = validBoard(saved.startBoard, n)
			? clone(saved.startBoard)
			: generate(n, new Set(board.flat()).size).board;
		moves = Number.isInteger(saved.moves) && saved.moves >= 0 ? saved.moves : 0;
		extra = board.length > new Set(board.flat()).size + 2;
		render();
		save();
	} else reset();
	marbleIds = assignMarbleIds(board);
	knownMarbles = new Set();
	$('#levels-dialog').close();
	$('#win-dialog').close();
	$('#message').textContent = won(board, activeCapacity())
		? 'Already sorted. Restart to play this level again.'
		: 'Tap a tube, then tap another to move marbles.';
	startMinimumCalculation();
	return true;
}
function renderLevels() {
	const start = levelPage * 40 + 1,
		end = Math.min(MAX_LEVEL, start + 39);
	$('#level-summary').textContent = allUnlocked
		? 'All levels unlocked'
		: `Unlocked through level ${unlocked}`;
	$('#level-range').textContent = `${start}–${end}`;
	$('#levels-prev').disabled = levelPage === 0;
	$('#levels-next').disabled = end === MAX_LEVEL;
	$('#level-grid').innerHTML = Array.from({ length: end - start + 1 }, (_, j) => {
		const n = start + j,
			locked = !allUnlocked && n > unlocked,
			done = completed.has(n),
			perfect = perfectLevels.has(n);
		return `<button class="level-tile ${n === level ? 'current' : ''} ${done ? 'completed' : ''} ${perfect ? 'perfect' : ''}" data-level="${n}" ${locked ? 'disabled' : ''} aria-label="Level ${n}${locked ? ', locked' : perfect ? ', completed perfectly' : done ? ', completed' : isDeepLevel(n) ? ', deep pour' : ''}" ${n === level ? 'aria-current="true"' : ''}><span>${n}</span><small>${locked ? 'Locked' : perfect ? '★' : done ? '✓' : isDeepLevel(n) ? `${colorCount(n)} colors · deep` : `${colorCount(n)} colors`}</small></button>`;
	}).join('');
	$('#level-grid')
		.querySelectorAll('button')
		.forEach((b) => (b.onclick = () => changeLevel(+b.dataset.level)));
}
function openLevels() {
	cancelWin();
	settleFlights();
	save();
	levelPage = Math.floor((level - 1) / 40);
	renderLevels();
	$('#levels-dialog').showModal();
}
$('#levels').onclick = openLevels;
$('#levels-close').onclick = () => $('#levels-dialog').close();
$('#levels-prev').onclick = () => {
	levelPage = Math.max(0, levelPage - 1);
	renderLevels();
};
$('#levels-next').onclick = () => {
	levelPage = Math.min(Math.ceil(MAX_LEVEL / 40) - 1, levelPage + 1);
	renderLevels();
};
$('#level-jump').onsubmit = (e) => {
	e.preventDefault();
	const n = Number($('#level-number').value);
	if (!validLevel(n)) {
		$('#level-feedback').textContent = `Choose a level from 1 to ${MAX_LEVEL.toLocaleString()}.`;
		return;
	}
	levelPage = Math.floor((n - 1) / 40);
	renderLevels();
	$('#level-feedback').textContent =
		!allUnlocked && n > unlocked ? 'Finish earlier levels to unlock this one.' : '';
};
function unlockAll() {
	allUnlocked = true;
	save();
	renderLevels();
	$('#debug-feedback').textContent = 'Every level is unlocked.';
	tone(990, 0.2);
	vibrate(15);
}
function showDebug() {
	$('#debug').hidden = false;
	requestAnimationFrame(fitBoard);
}
let logoTaps = 0;
$('.brand').addEventListener('click', (e) => {
	e.preventDefault();
	if (debugUnlocked) return;
	logoTaps++;
	if (logoTaps === 7) {
		debugUnlocked = true;
		showDebug();
		save();
		$('#message').textContent = 'Debug unlocked.';
		tone(990, 0.2);
		vibrate(15);
	}
});
$('#debug').onclick = () => $('#debug-dialog').showModal();
$('#debug-close').onclick = () => $('#debug-dialog').close();
$('#unlock-all').onclick = unlockAll;
['debug-colors', 'debug-capacity', 'debug-empty-tubes'].forEach((id) => {
	const input = $('#' + id),
		output = $('#' + id + '-value');
	input.oninput = () => (output.value = input.value);
});
$('#debug-level-form').onsubmit = (e) => {
	e.preventDefault();
	const seed = Number($('#debug-seed').value),
		colors = Number($('#debug-colors').value),
		cap = Number($('#debug-capacity').value),
		emptyTubes = Number($('#debug-empty-tubes').value),
		hiddenColors = $('#debug-hidden-colors').checked;
	if (
		![seed, colors, cap, emptyTubes].every(Number.isSafeInteger) ||
		seed < 1 ||
		colors < 2 ||
		colors > 12 ||
		cap < 2 ||
		cap > 12 ||
		emptyTubes < 1 ||
		emptyTubes > 6
	) {
		$('#debug-feedback').textContent =
			'Use a positive seed, 2–12 colors, 2–12 slots, and 1–6 empty tubes.';
		return;
	}
	loadDebugPuzzle(
		{ seed, colors, capacity: cap, emptyTubes, hiddenColors },
		generate(seed, colors, cap, emptyTubes).board,
	);
};
function loadDebugPuzzle(options, initial) {
	stopMinimum();
	cancelWin();
	settleFlights();
	save();
	customLevel = options;
	board = clone(initial);
	marbleIds = assignMarbleIds(board);
	knownMarbles = new Set();
	startBoard = clone(board);
	history = [];
	replayMoves = [];
	moves = 0;
	extra = false;
	selected = -1;
	render();
	fitBoard();
	startMinimumCalculation();
	$('#debug-dialog').close();
	document.activeElement?.blur();
	scrollTo(0, 0);
	$('#message').textContent =
		`Debug puzzle: ${options.colors} colors, ${options.capacity}-slot tubes${options.hiddenColors ? ', covered colors hidden' : ''}.`;
}
installHardLevelDebug(
	() => ({
		seed: Number($('#debug-seed').value),
		colors: Number($('#debug-colors').value),
		capacity: Number($('#debug-capacity').value),
		emptyTubes: Number($('#debug-empty-tubes').value),
		hiddenColors: $('#debug-hidden-colors').checked,
	}),
	loadDebugPuzzle,
);

let changingLevel = false;
async function changeLevel(n) {
	if (changingLevel || !validLevel(n) || (!allUnlocked && n > unlocked)) return;
	changingLevel = true;
	stopMinimum();
	save();
	$('#next').disabled = true;
	$('#level-grid').inert = true;
	const message = $('#update-status');
	message.textContent = '';
	try {
		// Only reload if the destination can be restored after navigation.
		let canReload = false;
		try {
			sessionStorage.setItem('prism-next-level', String(n));
			canReload = true;
		} catch {}
		if (canReload && (await updateBetweenLevels())) return;
		try {
			sessionStorage.removeItem('prism-next-level');
		} catch {}
		switchLevel(n);
	} finally {
		changingLevel = false;
		$('#next').disabled = false;
		$('#level-grid').inert = false;
		message.textContent = '';
	}
}
function renderSelection() {
	$('#board')
		.querySelectorAll('.tube')
		.forEach((el) => {
			const i = +el.dataset.i;
			el.classList.toggle('selected', selected === i);
			el.classList.toggle('valid', selected >= 0 && !!move(board, selected, i, activeCapacity()));
			el.setAttribute('aria-pressed', String(selected === i));
			const t = board[i];
			let run = 0;
			if (selected === i) for (let j = t.length - 1; j >= 0 && t[j] === t.at(-1); j--) run++;
			el.querySelectorAll('.marble').forEach((ball) => {
				const lifted = run > 0 && +ball.dataset.slot >= t.length - run;
				ball.style.transform = lifted
					? `translateY(-${tubeHeight() - 12 - (t.length - run) * 38}px)`
					: '';
			});
		});
}
// Touch-down is the action, not a delayed synthetic click on release.
$('#board').addEventListener('pointerdown', (e) => {
	if (!e.isPrimary || e.button !== 0 || changingLevel) return;
	const tube = e.target.closest('.tube');
	if (!tube) return;
	e.preventDefault();
	choose(+tube.dataset.i);
});
$('#board').addEventListener('click', (e) => {
	// Keyboard and assistive-technology activation still use click (detail 0).
	if (e.detail !== 0 || changingLevel) return;
	const tube = e.target.closest('.tube');
	if (tube) choose(+tube.dataset.i);
});
function fitBoard() {
	const el = $('#board'),
		main = document.querySelector('main');
	if (!main) return;
	const width = main.clientWidth - 24;
	const count = board.length,
		landscape = innerWidth > innerHeight;
	const gap = landscape ? 8 : 12;
	const chrome =
		document.querySelector('.intro').offsetHeight +
		document.querySelector('.controls').offsetHeight +
		$('#message').offsetHeight +
		document.querySelector('footer').offsetHeight +
		($('#debug').hidden ? 0 : $('#debug').offsetHeight + 18) +
		(landscape ? 40 : 70);
	const room = Math.max(70, main.clientHeight - chrome);
	let cols = 1,
		size = 0;
	for (let candidate = 1; candidate <= count; candidate++) {
		const rows = Math.ceil(count / candidate);
		const proposed = Math.min(
			90,
			(width - (candidate - 1) * gap) / candidate,
			(((room - (rows - 1) * gap) / rows) * 82) / tubeHeight(),
		);
		if (proposed > size) {
			size = proposed;
			cols = candidate;
		}
	}
	size = Math.max(20, size);
	el.style.setProperty('--tube-width', size + 'px');
	el.style.gridTemplateColumns = `repeat(${cols},${size}px)`;
	el.style.gap = gap + 'px';
}
addEventListener('resize', () => {
	settleFlights();
	fitBoard();
});
window.visualViewport?.addEventListener('resize', fitBoard);

addEventListener('scroll', () => settleFlights(), { passive: true });
document.addEventListener('visibilitychange', () => {
	if (document.hidden) settleFlights();
});

let optimalWorker = null;
let minimumCalculation = null;
function stopMinimum() {
	stopReview();
	optimalWorker?.terminate();
	optimalWorker = null;
	minimumCalculation = null;
}
let bestReplay = null,
	yourReplay = null,
	comparisonStep = 0;
function replayPath(initial, path) {
	if (!Array.isArray(path)) return null;
	let b = clone(initial),
		steps = [{ board: clone(b), label: 'Starting puzzle' }],
		count = 0;
	for (const event of path) {
		if (event === 'extra') {
			if (b.length >= 14) return null;
			b.push([]);
			steps[steps.length - 1].board = clone(b);
			steps[steps.length - 1].label += ' · extra tube added (free)';
			continue;
		}
		if (!Array.isArray(event) || event.length !== 2 || !event.every(Number.isInteger)) return null;
		const [a, z] = event,
			result = move(b, a, z, activeCapacity());
		if (!result) return null;
		b = result.board;
		count++;
		steps.push({
			board: clone(b),
			label: `Move ${count}: tube ${a + 1} → ${z + 1} · ${result.count} marble${result.count === 1 ? '' : 's'}`,
		});
	}
	return { steps, count, board: b };
}
function minimumInput() {
	const initial = clone(startBoard);
	if (extra && initial.length < board.length) initial.push([]);
	return initial;
}
function minimumCacheKey(initial) {
	return 'prism-optimal-v3:' + activeCapacity() + ':' + JSON.stringify(initial);
}
function validatedBestReplay(initial, result) {
	if (!result?.exact) return null;
	const candidate = replayPath(initial, result.path);
	if (!candidate || !won(candidate.board, activeCapacity()) || candidate.count !== result.minimum)
		return null;
	return candidate;
}
function refreshMinimumDisplay() {
	if (!customLevel && won(board, activeCapacity())) {
		recordWin();
		save();
		if ($('#levels-dialog').open) renderLevels();
	}
	if ($('#win-dialog').open) showMinimum();
}
function startMinimumCalculation() {
	const initial = minimumInput();
	const key = minimumCacheKey(initial);
	if (minimumCalculation?.key === key) return;

	stopMinimum();
	minimumCalculation = { initial, key, result: null, unavailable: false };

	try {
		const cached = JSON.parse(localStorage.getItem(key));
		if (cached?.exact && validatedBestReplay(initial, cached)) {
			minimumCalculation.result = cached;
			return;
		}
	} catch {}

	const calculation = minimumCalculation;
	function failed() {
		if (minimumCalculation !== calculation) return;
		calculation.unavailable = true;
		optimalWorker?.terminate();
		optimalWorker = null;
		refreshMinimumDisplay();
	}

	try {
		optimalWorker = new Worker(new URL('./optimal-worker.js', import.meta.url), { type: 'module' });
		optimalWorker.onmessage = ({ data }) => {
			if (minimumCalculation !== calculation) return;
			if (data.error) {
				failed();
				return;
			}
			if (data.exact && !validatedBestReplay(initial, data)) {
				failed();
				return;
			}
			calculation.result = data;
			if (data.exact) {
				try {
					localStorage.setItem(key, JSON.stringify(data));
				} catch {}
				optimalWorker?.terminate();
				optimalWorker = null;
			}
			refreshMinimumDisplay();
		};
		optimalWorker.onerror = failed;
		optimalWorker.postMessage({ board: initial, cap: activeCapacity() });
	} catch {
		failed();
	}
}
var reviewWorker = null,
	moveReviews = [],
	reviewStatus = 'idle';
function stopReview() {
	reviewWorker?.terminate();
	reviewWorker = null;
}
function startReview() {
	stopReview();
	moveReviews = [];
	reviewStatus = 'calculating';
	if (!yourReplay) {
		reviewStatus = 'missing';
		return;
	}
	const worker = new Worker(new URL('./review-worker.js', import.meta.url), { type: 'module' });
	reviewWorker = worker;
	worker.onmessage = ({ data }) => {
		if (reviewWorker !== worker) return;
		if (data.review) moveReviews[data.count - 1] = data.review;
		if (data.error || data.done) {
			reviewStatus = data.error ? 'error' : 'done';
			stopReview();
		}
		renderComparison();
	};
	worker.onerror = () => {
		reviewStatus = 'error';
		stopReview();
		renderComparison();
	};
	worker.postMessage({ board: startBoard, events: replayMoves, cap: activeCapacity() });
}
function reviewBoardSVG(position, review) {
	if (!position) return '';
	const height = tubeHeight();
	const layout = reviewLayout(position.length, height, $('#review-board').clientWidth - 26 || 300);
	function arrow(from, to, color, lane, label) {
		const route = reviewArrow(layout, from, to, lane === 95),
			marker = `review-arrow-${color}`;
		return `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker></defs>
		<path d="${route.path}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" marker-end="url(#${marker})"/>
		<text x="${route.labelX}" y="${route.labelY}" text-anchor="middle" fill="${color}" stroke="#171b32" stroke-width="5" paint-order="stroke" font-size="20" font-weight="700">${label}</text>`;
	}
	const arrows = review
		? arrow(
				review.from,
				review.to,
				review.good ? 'white' : 'red',
				40,
				review.good ? 'Your move' : `+${review.cost}`,
			) + (review.good ? '' : arrow(...review.recommended, 'limegreen', 95, 'Optimal'))
		: '';
	const description = review
		? `Your move: tube ${review.from + 1} to ${review.to + 1}. ${review.good ? 'Optimal.' : `Mistake, ${review.cost} extra moves. Optimal: tube ${review.recommended[0] + 1} to ${review.recommended[1] + 1}.`}`
		: 'Starting position';
	return `<svg class="review-position" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${description}">${position
		.map((tube, i) => {
			const point = layout.position(i);
			return `<g transform="translate(${point.x - 41},${point.y})"><svg width="82" height="${height}">${tubeSVG(tube, `review-${i}`)}</svg><text x="41" y="${height + 24}" fill="#dce3ff" font-size="20" text-anchor="middle">${i + 1}</text></g>`;
		})
		.join('')}${arrows}</svg>`;
}
function renderComparison() {
	const max = yourReplay?.count || 0;
	comparisonStep = Math.min(comparisonStep, max);
	$('#compare-step').max = max;
	$('#compare-step').value = comparisonStep;
	$('#compare-position').textContent =
		comparisonStep === 0 ? 'Starting puzzle' : `Move ${comparisonStep} of ${max}`;
	$('#compare-prev').disabled = comparisonStep === 0;
	$('#compare-next').disabled = comparisonStep === max;
	const review = moveReviews[comparisonStep - 1];
	const frame = yourReplay?.steps[comparisonStep];
	$('#your-caption').textContent = frame?.label || 'This attempt has no saved move history.';
	$('#best-caption').textContent = review?.good
		? 'White arrow: your move follows a shortest route.'
		: review
			? `Tube ${review.recommended[0] + 1} → ${review.recommended[1] + 1}: one shortest-route choice from your position.`
			: comparisonStep === 0
				? 'Select a move to see a shortest-route choice from that position.'
				: 'Calculating the exact shortest route…';
	$('#move-rating').textContent = review
		? `${review.good ? 'Good move' : 'Mistake: +' + review.cost + ' extra move' + (review.cost === 1 ? '' : 's')} · Shortest remaining: ${review.before} → ${review.after}`
		: comparisonStep === 0
			? 'Every shortest-route choice counts as good.'
			: 'This move has not been rated yet.';
	$('#review-board').innerHTML = reviewBoardSVG(
		review?.position || yourReplay?.steps[Math.max(0, comparisonStep - 1)]?.board,
		review,
	);
	const good = moveReviews.filter((r) => r.good).length;
	$('#compare-summary').textContent =
		`${moveReviews.length}/${max} moves rated · ${good} good · ${moveReviews.length - good} mistakes` +
		(reviewStatus === 'calculating'
			? ' · Calculating…'
			: reviewStatus === 'error'
				? ' · Analysis interrupted. Reopen to retry.'
				: reviewStatus === 'missing'
					? ' · Replay this level to record moves.'
					: '');
}
$('#compare').onclick = () => {
	comparisonStep = yourReplay?.count ? 1 : 0;
	startReview();
	$('#compare-dialog').showModal();
	renderComparison();
};
new ResizeObserver(() => {
	if ($('#compare-dialog').open) renderComparison();
}).observe($('#review-board'));
$('#compare-close').onclick = () => $('#compare-dialog').close();
$('#compare-dialog').addEventListener('close', stopReview);
$('#compare-prev').onclick = () => {
	comparisonStep--;
	renderComparison();
};
$('#compare-next').onclick = () => {
	comparisonStep++;
	renderComparison();
};
$('#compare-step').oninput = (e) => {
	comparisonStep = +e.target.value;
	renderComparison();
};
function showMinimum() {
	bestReplay = null;
	yourReplay = replayPath(startBoard, replayMoves);
	if (
		yourReplay &&
		(yourReplay.count !== moves || JSON.stringify(yourReplay.board) !== JSON.stringify(board))
	)
		yourReplay = null;
	startMinimumCalculation();
	const calculation = minimumCalculation;
	const label = $('#win-minimum');
	$('#win-rules').textContent =
		`From the starting puzzle${extra ? ', with the free extra tube available from the start' : ''}. A matching group moved together counts as one move. The final move counts; selections and undo do not.`;
	if (calculation.unavailable) {
		label.textContent = 'Theoretical minimum: unavailable';
		$('#best-caption').textContent =
			'The best solution could not be calculated. Reopen this level to retry.';
	} else if (calculation.result?.exact) {
		bestReplay = validatedBestReplay(calculation.initial, calculation.result);
		label.textContent = `Theoretical minimum: ${calculation.result.minimum} moves`;
	} else if (calculation.result) {
		label.textContent = `Theoretical minimum: at least ${calculation.result.minimum} moves · still calculating`;
	} else {
		label.textContent = 'Theoretical minimum: calculating…';
	}
	renderComparison();
}

let particles = [],
	raf = 0,
	ctx = $('#particles').getContext('2d');
function burst(x, y, n) {
	if (reduced) return;
	for (let i = 0; i < n; i++)
		particles.push({
			x,
			y,
			vx: (Math.random() - 0.5) * 8,
			vy: -Math.random() * 7 - 1,
			life: 1,
			size: Math.random() * 4 + 2,
			c: colors[i % colors.length],
		});
	if (!raf) raf = requestAnimationFrame(frame);
}
function frame() {
	let c = ctx.canvas;
	if (c.width !== innerWidth || c.height !== innerHeight) {
		c.width = innerWidth;
		c.height = innerHeight;
	}
	ctx.clearRect(0, 0, c.width, c.height);
	particles = particles.filter((p) => p.life > 0);
	for (let p of particles) {
		p.x += p.vx;
		p.y += p.vy;
		p.vy += 0.12;
		p.life -= 0.015;
		ctx.globalAlpha = Math.max(0, p.life);
		ctx.fillStyle = p.c;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	raf = particles.length ? requestAnimationFrame(frame) : 0;
}
render();
if (debugUnlocked) showDebug();
let pendingLevel = 0;
try {
	pendingLevel = Number(sessionStorage.getItem('prism-next-level'));
	sessionStorage.removeItem('prism-next-level');
} catch {}
if (validLevel(pendingLevel)) switchLevel(pendingLevel);
startMinimumCalculation();
const showRestoredWin = () => {
	if (won(board, activeCapacity()) && !$('#win-dialog').open) celebrate();
};
if (
	!installWelcome({
		dialog: $('#welcome-dialog'),
		play: $('#welcome-play'),
		close: $('#welcome-close'),
		debug: $('#debug-welcome'),
		settle: settleFlights,
		onDismiss: showRestoredWin,
		storage: () => localStorage,
	})
)
	showRestoredWin();
