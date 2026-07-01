export interface Logger {
	debug(msg: string, meta?: Record<string, unknown>): void;
	info(msg: string, meta?: Record<string, unknown>): void;
	warn(msg: string, meta?: Record<string, unknown>): void;
	error(msg: string, meta?: Record<string, unknown>): void;
	child(component: string): Logger;
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function parseLevel(raw: string | undefined): Level {
	if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
	return 'info';
}

const MIN_LEVEL = RANK[parseLevel(process.env.LOG_LEVEL)];

class LoggerImpl implements Logger {
	constructor(private readonly component: string) {}

	debug(msg: string, meta?: Record<string, unknown>) { this.emit('debug', msg, meta); }
	info(msg: string, meta?: Record<string, unknown>)  { this.emit('info',  msg, meta); }
	warn(msg: string, meta?: Record<string, unknown>)  { this.emit('warn',  msg, meta); }
	error(msg: string, meta?: Record<string, unknown>) { this.emit('error', msg, meta); }

	child(component: string): Logger { return new LoggerImpl(component); }

	private emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
		if (RANK[level] < MIN_LEVEL) return;
		process.stderr.write(
			`${JSON.stringify({ ts: new Date().toISOString(), level, component: this.component, msg, ...meta })}\n`,
		);
	}
}

export function createLogger(component: string): Logger {
	return new LoggerImpl(component);
}
