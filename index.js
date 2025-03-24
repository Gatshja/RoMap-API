const express = require("express");
const axios = require("axios");
const sharp = require("sharp");

const app = express();
const PORT = 6218;

app.get("/map", async (req, res) => {
    try {
        // Get user input from query parameters
        const { lat, lon, zoom, width, height } = req.query;

        // Validate parameters
        if (!lat || !lon || !zoom || !width || !height) {
            return res.status(400).json({ error: "Missing required parameters: lat, lon, zoom, width, height" });
        }

        // Generate map URL with custom parameters
        const MAP_URL = `https://maps.locationiq.com/v3/staticmap?key=pk.64f2afc23b900c19b64c46b2dd6a3945&center=${lat},${lon}&zoom=${zoom}&size=${width}x${height}`;

        // Download the map image
        const response = await axios.get(MAP_URL, { responseType: "arraybuffer" });
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

        res.set("Content-Type", "image/png");
        res.send(finalImage);
    } catch (error) {
        console.error("Error processing map:", error);
        res.status(500).send("Error processing map.");
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Map API running at http://localhost:${PORT}`);
});
