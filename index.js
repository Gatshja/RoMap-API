
const express = require("express");
const axios = require("axios");
const sharp = require("sharp");
const cors = require("cors");
const NodeCache = require("node-cache");
const session = require("express-session");
const apiKeys = require("./apiKeys");
const requestLogger = require("./requestLogger");
const rateLimiter = require("./rateLimiter");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 6218;
const API_KEY = process.env.LOCATIONIQ_API_KEY || "pk.64f2afc23b900c19b64c46b2dd6a3945";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // Consider changing this in production

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Setup session for admin authentication
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 3600000 } // 1 hour
}));

// Request logging middleware
app.use((req, res, next) => {
    // Skip logging for static files and monitoring endpoints
    if (req.path.startsWith('/public/') || req.path === '/admin/monitor-data') {
        return next();
    }
    
    const startTime = Date.now();
    
    // Capture the original send function
    const originalSend = res.send;
    
    // Override the send function to log after response is sent
    res.send = function() {
        // Call the original send function with all arguments
        originalSend.apply(res, arguments);
        
        // Log the request after sending response
        requestLogger.logRequest(req, res, startTime);
    };
    
    next();
});

// Add rate limiting middleware
app.use(rateLimiter.rateLimiter);

// Setup cache with 1 hour TTL
const mapCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Serve static files
app.use(express.static("public"));

// Authentication middleware for admin routes
const authenticateAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
};

// Authentication middleware for API requests
const authenticateApiKey = (req, res, next) => {
    // Get API key from header or query parameter
    const apiKey = req.headers['x-api-key'] || req.query.apikey;
    
    // Skip API key check if query has direct parameters
    if (req.query.direct === 'true') {
        return next();
    }
    
    if (!apiKey) {
        return res.status(401).json({ error: "API key is required" });
    }
    
    // Check if the key exists but is suspended
    const keyStatus = apiKeys.checkKeyStatus(apiKey);
    
    if (keyStatus === 'suspended') {
        return res.status(403).json({ 
            error: "Your KEY is Suspended. Contact Support contact@robloxbot.dpdns.org"
        });
    } else if (keyStatus === 'invalid') {
        return res.status(401).json({ error: "Invalid API key" });
    }
    
    next();
};

// Home page with documentation
app.get("/", (req, res) => {
    res.send(`
        <html>
        <head>
            <title>RoMap API</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; }
                h1, h2 { color: #333; }
                .example { margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>RoMap API Documentation</h1>
            <p>The RoMap API provides map images with custom branding.</p>
            
            <h2>Endpoints</h2>
            <h3>GET /map</h3>
            <p>Returns a map image for the specified location with RoMap branding.</p>
            
            <h4>Authentication:</h4>
            <p>This endpoint requires an API key passed either:</p>
            <ul>
                <li>In the <code>X-API-Key</code> header (recommended for security)</li>
                <li>As an <code>apikey</code> query parameter in the URL</li>
            </ul>
            <p>You can get an API key from the <a href="/admin">admin page</a>.</p>
            
            <h4>Query Parameters:</h4>
            <ul>
                <li><strong>lat</strong> (required): Latitude of the map center</li>
                <li><strong>lon</strong> (required): Longitude of the map center</li>
                <li><strong>zoom</strong> (required): Zoom level (1-18)</li>
                <li><strong>width</strong> (required): Image width in pixels</li>
                <li><strong>height</strong> (required): Image height in pixels</li>
                <li><strong>maptype</strong> (optional): Map type (roadmap, satellite, terrain)</li>
                <li><strong>direct</strong> (optional): Set to 'true' to bypass API key check (for testing only)</li>
            </ul>
            
            <h2>API Usage Rules</h2>
            <div class="rules-section">
                <p>By using the RoMap API, you agree to abide by the following rules:</p>
                
                <ol>
                    <li><strong>Authentication Requirements</strong>: All requests must include a valid API key.</li>
                    <li><strong>Rate Limiting</strong>: Each API key is limited to 1,000 requests per day.</li>
                    <li><strong>Attribution</strong>: The RoMap watermark and credit must remain visible on all maps.</li>
                    <li><strong>Data Usage</strong>: Generated maps are for use in your application only and should not be redistributed or sold.</li>
                    <li><strong>Caching</strong>: You may cache map images for up to 24 hours to reduce API calls.</li>
                    <li><strong>Terms Compliance</strong>: Usage must comply with LocationIQ's terms of service.</li>
                    <li><strong>Application Information</strong>: When requesting an API key, provide accurate information about your application and intended use.</li>
                    <li><strong>Key Security</strong>: Keep your API key secure; do not share it or expose it in client-side code.</li>
                    <li><strong>Account Termination</strong>: API keys may be suspended or revoked for violations of these rules.</li>
                    <li><strong>Support Contact</strong>: For questions or support, contact contact@robloxbot.dpdns.org</li>
                </ol>
            </div>
            
            <div class="example">
                <h4>Example:</h4>
                <pre>GET /map?lat=40.7128&lon=-74.0060&zoom=14&width=600&height=400</pre>
            </div>
            
            <h2>Health Check</h2>
            <p>GET /health returns the API status.</p>
            
            <h2>Status</h2>
            <p>API Version: 1.0.0</p>
            <p>Server Status: Running</p>
            <h2>Admin Links</h2>
            <p><a href="/admin">Admin Dashboard</a> - Manage API keys</p>
            <p><a href="/monitor">API Monitor</a> - Watch API traffic in real-time</p>
        </body>
        </html>
    `);
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Admin page
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Monitor page
app.get("/monitor", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "monitor.html"));
});

// Get monitoring data
app.get("/admin/monitor-data", authenticateAdmin, (req, res) => {
    try {
        const logs = requestLogger.getAllLogs();
        const stats = requestLogger.getStats();
        
        res.json({
            requests: logs,
            totalRequests: stats.totalRequests,
            successRate: stats.successRate,
            cacheRate: stats.cacheRate
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve monitoring data" });
    }
});

// Admin login
app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// Generate API key (admin only)
app.post("/admin/generate-key", authenticateAdmin, (req, res) => {
    const { name, isAdmin } = req.body;
    
    if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Key name is required" });
    }
    
    try {
        const apiKey = apiKeys.generateKey(name, isAdmin === true);
        res.json({ success: true, apiKey });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate API key" });
    }
});

// Toggle maintenance mode (admin only)
app.post("/admin/maintenance", authenticateAdmin, (req, res) => {
    const { enabled } = req.body;
    
    try {
        const status = rateLimiter.setMaintenanceMode(enabled === true);
        res.json({ 
            success: true, 
            maintenanceMode: status,
            message: status ? "Maintenance mode enabled" : "Maintenance mode disabled"
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to toggle maintenance mode" });
    }
});

// Get maintenance mode status
app.get("/admin/maintenance", authenticateAdmin, (req, res) => {
    try {
        const status = rateLimiter.getMaintenanceMode();
        res.json({ maintenanceMode: status });
    } catch (error) {
        res.status(500).json({ error: "Failed to get maintenance mode status" });
    }
});

// Get all API keys (admin only)
app.get("/admin/keys", authenticateAdmin, (req, res) => {
    try {
        const keys = apiKeys.getAllKeys();
        res.json({ keys });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve API keys" });
    }
});

// Revoke API key (admin only)
app.delete("/admin/revoke-key/:id", authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    try {
        apiKeys.revokeKey(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to revoke API key" });
    }
});

// Suspend API key (admin only)
app.put("/admin/suspend-key/:id", authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    try {
        const result = apiKeys.suspendKey(id);
        if (result) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to suspend API key" });
    }
});

// Activate API key (admin only)
app.put("/admin/activate-key/:id", authenticateAdmin, (req, res) => {
    const { id } = req.params;
    
    try {
        const result = apiKeys.activateKey(id);
        if (result) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "API key not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to activate API key" });
    }
});

app.get("/map", authenticateApiKey, async (req, res) => {
    try {
        // Get user input from query parameters
        const { lat, lon, zoom, width, height, maptype } = req.query;

        // Validate required parameters
        if (!lat || !lon || !zoom || !width || !height) {
            return res.status(400).json({ 
                error: "Missing required parameters", 
                required: ["lat", "lon", "zoom", "width", "height"],
                received: req.query
            });
        }

        // Validate parameter types and ranges
        const numLat = parseFloat(lat);
        const numLon = parseFloat(lon);
        const numZoom = parseInt(zoom);
        const numWidth = parseInt(width);
        const numHeight = parseInt(height);

        if (isNaN(numLat) || numLat < -90 || numLat > 90) {
            return res.status(400).json({ error: "Invalid latitude. Must be between -90 and 90." });
        }
        if (isNaN(numLon) || numLon < -180 || numLon > 180) {
            return res.status(400).json({ error: "Invalid longitude. Must be between -180 and 180." });
        }
        if (isNaN(numZoom) || numZoom < 1 || numZoom > 18) {
            return res.status(400).json({ error: "Invalid zoom. Must be between 1 and 18." });
        }
        if (isNaN(numWidth) || numWidth < 50 || numWidth > 2000) {
            return res.status(400).json({ error: "Invalid width. Must be between 50 and 2000." });
        }
        if (isNaN(numHeight) || numHeight < 50 || numHeight > 2000) {
            return res.status(400).json({ error: "Invalid height. Must be between 50 and 2000." });
        }

        // Create a cache key
        const cacheKey = `map_${lat}_${lon}_${zoom}_${width}_${height}_${maptype || 'default'}`;
        
        // Check if we have a cached version
        const cachedImage = mapCache.get(cacheKey);
        if (cachedImage) {
            res.set("Content-Type", "image/png");
            res.set("X-Cache", "HIT");
            return res.send(cachedImage);
        }

        // Generate map URL with custom parameters
        let mapTypeParam = "";
        if (maptype) {
            mapTypeParam = `&maptype=${maptype}`;
        }
        
        const MAP_URL = `https://maps.locationiq.com/v3/staticmap?key=${API_KEY}&center=${numLat},${numLon}&zoom=${numZoom}&size=${numWidth}x${numHeight}${mapTypeParam}`;

        // Download the map image
        const response = await axios.get(MAP_URL, { 
            responseType: "arraybuffer",
            timeout: 10000 // 10 second timeout
        });
        
        let image = sharp(response.data);

        // Load the updated credit image
        const creditImage = await sharp("robloxbot_map_api_final.png")
            .resize(400, 35) // Ensure correct size
            .toBuffer();

        // Get map dimensions to place credit dynamically
        const metadata = await image.metadata();
        const mapWidth = metadata.width;
        const mapHeight = metadata.height;

        // Correct placement: Bottom Right
        const creditWidth = 400;
        const creditHeight = 35;
        const left = mapWidth - creditWidth - 5; // 5px padding from right
        const top = mapHeight - creditHeight - 3; // 5px padding from bottom

        // Composite the new credit text onto the map
        image = image.composite([
            { input: creditImage, top: top, left: left }
        ]);

        const finalImage = await image.toBuffer();
        
        // Cache the result
        mapCache.set(cacheKey, finalImage);

        // Send the response
        res.set("Content-Type", "image/png");
        res.set("X-Cache", "MISS");
        res.send(finalImage);
    } catch (error) {
        console.error("Error processing map:", error);
        
        // Provide more detailed error response
        if (error.response) {
            // The request was made but the server responded with an error
            return res.status(error.response.status).json({
                error: "External map service error",
                details: error.response.statusText,
                status: error.response.status
            });
        } else if (error.request) {
            // The request was made but no response was received
            return res.status(503).json({
                error: "Unable to connect to map service",
                details: "No response received from external map service"
            });
        } else {
            // Something else happened in making the request
            return res.status(500).json({
                error: "Internal server error",
                message: error.message
            });
        }
    }
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({
        error: "Not Found",
        message: `The requested resource '${req.path}' does not exist.`,
        availableEndpoints: ["/", "/map", "/health"]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        requestId: Date.now().toString()
    });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`RoMap API v2.0.0 running at http://0.0.0.0:${PORT}`);
    console.log(`- Documentation: http://0.0.0.0:${PORT}/`);
    console.log(`- Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`- Map endpoint: http://0.0.0.0:${PORT}/map?lat=40.7128&lon=-74.0060&zoom=14&width=600&height=400&direct=true`);
    console.log(`- Admin page: http://0.0.0.0:${PORT}/admin`);
    console.log(`  Default admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
});
