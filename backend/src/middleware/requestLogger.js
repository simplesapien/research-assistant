// File: backend/src/middleware/requestLogger.js

const log = require('../utils/logger');

const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log when the request starts
    log("Incoming API Request", {
        method: req.method,
        path: req.originalUrl,
    });

    // Log when the response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        log("API Request Completed", {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration: `${duration} ms`
        });
    });

    next();
};

module.exports = requestLogger;
