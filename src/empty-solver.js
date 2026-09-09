const unavailable = () => {
	throw Error('Main-thread solver is only included in the JS13K build.');
};

export const optimal = unavailable;
export const reviewMoves = unavailable;
