// File: backend/src/utils/logger.js

const log = (message, details = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (Object.keys(details).length > 0) {
        console.log("Details:", JSON.stringify(details, null, 2));
    }
};

module.exports = log;
