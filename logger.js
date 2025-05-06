// logger.js
const winston = require('winston');

const winston = require('winston');
// logger.js
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'app.log');

const logger = {
    info: (message, ...args) => {
        const logMessage = `[INFO] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
        console.log(logMessage);
        fs.appendFileSync(logFile, logMessage + '\n');
    },
    warn: (message, ...args) => {
        const logMessage = `[WARN] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
        console.warn(logMessage);
        fs.appendFileSync(logFile, logMessage + '\n');
    },
    error: (message, ...args) => {
        const logMessage = `[ERROR] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
        console.error(logMessage);
        fs.appendFileSync(logFile, logMessage + '\n');
    },
    debug: (message, ...args) => {
        const logMessage = `[DEBUG] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}`;
        console.debug(logMessage);
        fs.appendFileSync(logFile, logMessage + '\n');
    }
};

module.exports = logger;