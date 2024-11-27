const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function verifyJwtToken(request, h) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return h.response({ error: 'Authorization header missing' }).code(401).takeover();
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Verify and decode token
        request.user = decoded; // Attach user data (e.g., user ID) to the request object
        return h.continue; // Allow the request to proceed
    } catch (err) {
        console.error('Invalid or expired token:', err);
        return h.response({ error: 'Invalid or expired token' }).code(403).takeover();
    }
}

module.exports = { verifyJwtToken };