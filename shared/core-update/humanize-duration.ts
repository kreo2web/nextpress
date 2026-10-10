/**
 * A duration in words people read at a glance ("about 2 minutes"), never raw milliseconds.
 * Rounds to the nearest minute or hour; anything under ten seconds is "a few seconds".
 */
export const humanizeDuration = (ms: number): string => {
	const seconds = Math.max(0, Math.round(ms / 1000));
	if (seconds < 10) return "a few seconds";
	if (seconds < 45) return "less than a minute";

	const minutes = Math.round(seconds / 60);
	if (minutes <= 1) return "about a minute";
	if (minutes < 60) return `about ${minutes} minutes`;

	const hours = Math.round(minutes / 60);
	return hours <= 1 ? "about an hour" : `about ${hours} hours`;
};
