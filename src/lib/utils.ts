export function padded(s: string, width: number): string {
	return s.length > width - 1 ? `${s.slice(0, width - 2)}… ` : s.padEnd(width);
}
