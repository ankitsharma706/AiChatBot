import winston from 'winston';

const { combine, timestamp, colorize, printf, errors } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'HH:mm:ss' }),
        colorize({ all: true }),
        devFormat
    ),
    transports: [new winston.transports.Console()],
});
