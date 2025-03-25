
const NodeCache = require('node-cache');

// Cache for storing rate limit data
const rateCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 }); // 24 hours TTL

// Default rate limit (can be overridden for admin keys)
const DEFAULT_RATE_LIMIT = 1000; // requests per day

// Add maintenance mode flag
let maintenanceMode = false;

// Rate limiter middleware
function rateLimiter(req, res, next) {
    // Skip rate limiting in certain conditions
    if (req.path.startsWith('/admin') || req.path === '/health' || req.path === '/') {
        return next();
    }
    
    // Check if system is in maintenance mode
    if (maintenanceMode) {
        return res.status(503).json({
            error: "Service Unavailable",
            message: "Undermaintenance. Ours Team in fixing API Key",
            contact: "contact@robloxbot.dpdns.org"
        });
    }
    
    const apiKey = req.headers['x-api-key'] || req.query.apikey;
    
    // Skip if direct parameter is used
    if (req.query.direct === 'true') {
        return next();
    }
    
    if (!apiKey) {
        return next(); // Let the auth middleware handle this case
    }
    
    // Get the current day (for daily rate limiting)
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${apiKey}:${today}`;
    
    // Get current count from cache
    let count = rateCache.get(cacheKey) || 0;
    
    // Get rate limit for this key (check if it's an admin key with unlimited access)
    const rateLimit = getKeyRateLimit(apiKey);
    
    // Check if rate limit exceeded
    if (rateLimit !== -1 && count >= rateLimit) {
        return res.status(429).json({
            error: "Rate Limit Exceeded",
            message: `You have exceeded your daily limit of ${rateLimit} requests. The limit resets at midnight UTC.`,
            limit: rateLimit,
            current: count,
            reset: `${today}T23:59:59Z`
        });
    }
    
    // Increment the counter
    rateCache.set(cacheKey, count + 1);
    
    // Add rate limit headers
    if (rateLimit !== -1) {
        res.set('X-RateLimit-Limit', rateLimit.toString());
        res.set('X-RateLimit-Remaining', Math.max(0, rateLimit - count - 1).toString());
        res.set('X-RateLimit-Reset', `${today}T23:59:59Z`);
    } else {
        res.set('X-RateLimit-Limit', 'unlimited');
        res.set('X-RateLimit-Remaining', 'unlimited');
    }
    
    next();
}

// Function to get key-specific rate limit
function getKeyRateLimit(apiKey) {
    try {
        const apiKeys = require('./apiKeys');
        const keyInfo = apiKeys.getKeyInfo(apiKey);
        
        // If it's an admin key with unlimited access
        if (keyInfo && keyInfo.isAdmin) {
            return -1; // unlimited
        }
        
        // Default rate limit
        return DEFAULT_RATE_LIMIT;
    } catch (error) {
        console.error('Error getting key rate limit:', error);
        return DEFAULT_RATE_LIMIT;
    }
}

// Toggle maintenance mode
function setMaintenanceMode(enabled) {
    maintenanceMode = enabled;
    return maintenanceMode;
}

// Get maintenance mode status
function getMaintenanceMode() {
    return maintenanceMode;
}

module.exports = {
    rateLimiter,
    setMaintenanceMode,
    getMaintenanceMode
};
