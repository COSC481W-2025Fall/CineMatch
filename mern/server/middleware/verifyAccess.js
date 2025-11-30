// mern/server/middleware/verifyAccess.js
import jwt from 'jsonwebtoken';

// Express middleware to verify an access token from the Authorization header
export default function verifyAccess(req, res, next) {
    try {
        const hdr = req.headers.authorization || '';
        const [, token] = hdr.split(' ');
        if (!token) return res.status(401).json({ error: 'Missing bearer token' });

        // Verify the token using the access secret
        const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        // Attach a minimal user identity to the request
        req.user = { id: payload.sub, email: payload.email };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
    }
}
