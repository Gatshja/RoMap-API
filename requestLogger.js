
const fs = require('fs');
const path = require('path');

// Ensure the logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const LOG_FILE = path.join(logsDir, 'request_log.json');

// Initialize empty log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ requests: [] }));
}

// Load logs from file
function loadLogs() {
    try {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading request logs:', error);
        return { requests: [] };
    }
}

// Save logs to file
function saveLogs(logsData) {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(logsData, null, 2));
    } catch (error) {
        console.error('Error saving request logs:', error);
    }
}

// Log a new request
function logRequest(req, res, startTime) {
    const logsData = loadLogs();
    
    // Limit the number of stored requests (keep most recent 100)
    if (logsData.requests.length >= 100) {
        logsData.requests.shift(); // Remove oldest request
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Create a request log entry
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        responseTime: responseTime,
        cache: res.getHeader('X-Cache')
    };
    
    // Add the log to the list
    logsData.requests.push(logEntry);
    
    // Save the updated logs
    saveLogs(logsData);
    
    return logEntry;
}

// Get all request logs
function getAllLogs() {
    return loadLogs().requests;
}

// Get stats from logs
function getStats() {
    const logs = loadLogs().requests;
    
    const totalRequests = logs.length;
    
    // Calculate success rate
    const successfulRequests = logs.filter(log => log.status < 400).length;
    const successRate = totalRequests > 0 
        ? Math.round((successfulRequests / totalRequests) * 100) 
        : 0;
    
    // Calculate cache hit rate
    const cacheHits = logs.filter(log => log.cache === 'HIT').length;
    const requestsWithCacheHeader = logs.filter(log => log.cache === 'HIT' || log.cache === 'MISS').length;
    const cacheRate = requestsWithCacheHeader > 0 
        ? Math.round((cacheHits / requestsWithCacheHeader) * 100) 
        : 0;
    
    return {
        totalRequests,
        successRate,
        cacheRate
    };
}

module.exports = {
    logRequest,
    getAllLogs,
    getStats
};
