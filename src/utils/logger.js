import winston from 'winston';

const transports = [new winston.transports.Console()];

// File transports only make sense when running the server. They are skipped
// under NODE_ENV=test so `npm test` never writes logs/ into the repo.
if (process.env.NODE_ENV !== 'test') {
  const jsonFileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );

  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFileFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFileFormat
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level}]: ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports
});
