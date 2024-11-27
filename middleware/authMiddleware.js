const jwt = require('jsonwebtoken');
const { admin } = require('../server'); // Assuming admin is exported from server.js

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function verifyJwtToken(request, h) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return h.response({ error: 'Authorization header missing' }).code(401).takeover();
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Verify the token
        request.user = decoded; // Attach user data (e.g., user ID) to the request
        return h.continue;
    } catch (err) {
        return h.response({ error: 'Invalid or expired token' }).code(403).takeover();
    }
}

module.exports = { verifyJwtToken };