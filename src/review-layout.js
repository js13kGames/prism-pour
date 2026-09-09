// SVG-space geometry, independent of the DOM and puzzle rules.
export function reviewLayout(count, tubeHeight, availableWidth) {
	const columns = Math.min(count, Math.max(6, Math.min(8, Math.floor(availableWidth / 60))));
	const rows = Math.ceil(count / columns);
	const width = columns * 86 + 24;
	const rowHeight = tubeHeight + 68;
	return {
		columns,
		rows,
		width,
		height: rows * rowHeight,
		position(index) {
			return { x: 55 + (index % columns) * 86, y: 36 + Math.floor(index / columns) * rowHeight };
		},
	};
}

export function reviewArrow(layout, from, to, optimal = false) {
	const source = layout.position(from),
		target = layout.position(to);
	const offset = optimal ? 7 : -7;
	const x = source.x + offset,
		end = target.x + offset;
	const startY = source.y - 2,
		endY = target.y - 4;
	const dx = end - x,
		dy = endY - startY;
	const distance = Math.hypot(dx, dy);
	const sameRow = source.y === target.y;
	// One continuous quadratic arc: low arches within a row, bowed diagonals
	// between rows. No extra gutters or right-angle detours are needed.
	const bend = optimal ? -60 : 80;
	const controlX = sameRow
		? (x + end) / 2
		: Math.max(16, Math.min(layout.width - 16, (x + end) / 2 - (dy / distance) * bend));
	const controlY = sameRow
		? Math.max(0, source.y - (optimal ? 34 : 58))
		: (startY + endY) / 2 + (dx / distance) * bend;
	return {
		path: `M${x} ${startY}Q${controlX} ${controlY} ${end} ${endY}`,
		labelX: Math.max(55, Math.min(layout.width - 55, (x + 2 * controlX + end) / 4)),
		labelY: (startY + 2 * controlY + endY) / 4 - 8,
	};
}
