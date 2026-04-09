import { Request, Response, NextFunction } from 'express';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return GREEN;
    case 'POST': return CYAN;
    case 'PUT': case 'PATCH': return YELLOW;
    case 'DELETE': return RED;
    default: return MAGENTA;
  }
}

function statusColor(status: number): string {
  if (status < 300) return GREEN;
  if (status < 400) return CYAN;
  if (status < 500) return YELLOW;
  return RED;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path: reqPath } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const mCol = methodColor(method);
    const sCol = statusColor(status);

    console.log(
      `${DIM}[Luna]${RESET} ` +
      `${mCol}${method.padEnd(6)}${RESET} ` +
      `${reqPath.padEnd(40)} ` +
      `${sCol}${status}${RESET} ` +
      `${DIM}${ms}ms${RESET}`
    );
  });

  next();
}
