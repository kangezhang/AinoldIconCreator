import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const LOG_FILENAME = 'ainold-icon-creator.log';

function resolvePrimaryLogPath() {
  if (app && app.isPackaged) {
    return path.join(path.dirname(process.execPath), LOG_FILENAME);
  }

  return path.join(process.cwd(), LOG_FILENAME);
}

function resolveFallbackLogPath() {
  try {
    return path.join(app.getPath('userData'), LOG_FILENAME);
  } catch {
    return path.join(process.cwd(), LOG_FILENAME);
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function appendLog(line: string) {
  const primaryPath = resolvePrimaryLogPath();
  try {
    fs.appendFileSync(primaryPath, line, 'utf8');
    return primaryPath;
  } catch {
    const fallbackPath = resolveFallbackLogPath();
    try {
      fs.appendFileSync(fallbackPath, line, 'utf8');
      return fallbackPath;
    } catch {
      return null;
    }
  }
}

function formatLine(level: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const suffix = data === undefined ? '' : ` ${safeStringify(data)}`;
  return `[${timestamp}] ${level} ${message}${suffix}\n`;
}

export function logInfo(message: string, data?: unknown) {
  appendLog(formatLine('INFO', message, data));
}

export function logError(message: string, error?: unknown) {
  appendLog(formatLine('ERROR', message, error));
}
