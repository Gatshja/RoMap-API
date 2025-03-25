
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Ensure the keys directory exists
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

const KEYS_FILE = path.join(keysDir, 'api_keys.json');

// Initialize empty keys file if it doesn't exist
if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: [] }));
}

// Load keys from file
function loadKeys() {
    try {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading API keys:', error);
        return { keys: [] };
    }
}

// Save keys to file
function saveKeys(keysData) {
    try {
        fs.writeFileSync(KEYS_FILE, JSON.stringify(keysData, null, 2));
    } catch (error) {
        console.error('Error saving API keys:', error);
    }
}

// Generate a new API key
function generateKey(name, isAdmin = false) {
    const keysData = loadKeys();
    
    // Generate a random API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Create a key object
    const keyObj = {
        id: crypto.randomBytes(8).toString('hex'),
        name: name,
        key: apiKey,
        created: new Date().toISOString(),
        isAdmin: isAdmin || false
    };
    
    // Add the key to the list
    keysData.keys.push(keyObj);
    
    // Save the updated keys
    saveKeys(keysData);
    
    return apiKey;
}

// Get all API keys (without the actual key values)
function getAllKeys() {
    const keysData = loadKeys();
    
    // Return keys without the actual key value for security
    return keysData.keys.map(key => ({
        id: key.id,
        name: key.name,
        created: key.created,
        suspended: key.suspended || false,
        isAdmin: key.isAdmin || false
    }));
}

// Get key information by API key
function getKeyInfo(apiKey) {
    const keysData = loadKeys();
    const keyObj = keysData.keys.find(key => key.key === apiKey);
    
    if (!keyObj) {
        return null;
    }
    
    return {
        id: keyObj.id,
        name: keyObj.name,
        created: keyObj.created,
        suspended: keyObj.suspended || false,
        isAdmin: keyObj.isAdmin || false
    };
}

// Validate an API key
function validateKey(apiKey) {
    const keysData = loadKeys();
    
    // Check if the key exists and is not suspended
    return keysData.keys.some(key => key.key === apiKey && !key.suspended);
}

// Check key status (valid, suspended, or invalid)
function checkKeyStatus(apiKey) {
    const keysData = loadKeys();
    
    // Find the key
    const keyObj = keysData.keys.find(key => key.key === apiKey);
    
    if (!keyObj) {
        return 'invalid';
    }
    
    return keyObj.suspended ? 'suspended' : 'valid';
}

// Suspend an API key
function suspendKey(keyId) {
    const keysData = loadKeys();
    
    // Find and suspend the key
    const keyIndex = keysData.keys.findIndex(key => key.id === keyId);
    if (keyIndex !== -1) {
        keysData.keys[keyIndex].suspended = true;
        saveKeys(keysData);
        return true;
    }
    return false;
}

// Activate a suspended API key
function activateKey(keyId) {
    const keysData = loadKeys();
    
    // Find and activate the key
    const keyIndex = keysData.keys.findIndex(key => key.id === keyId);
    if (keyIndex !== -1) {
        keysData.keys[keyIndex].suspended = false;
        saveKeys(keysData);
        return true;
    }
    return false;
}

// Revoke (delete) an API key
function revokeKey(keyId) {
    const keysData = loadKeys();
    
    // Filter out the key with the specified ID
    keysData.keys = keysData.keys.filter(key => key.id !== keyId);
    
    // Save the updated keys
    saveKeys(keysData);
}

module.exports = {
    generateKey,
    getAllKeys,
    validateKey,
    revokeKey,
    suspendKey,
    activateKey,
    checkKeyStatus,
    getKeyInfo
};
