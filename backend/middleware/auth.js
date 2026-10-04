const jwt = require("jsonwebtoken");
const prisma = require('../config/prisma');

const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
    try {
        if (!Number.isInteger(decoded.id)) {
            return res.status(401).json({ message: "Invalid token" });
        }
        // Check the database so withdrawal also blocks already-issued tokens.
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, role: true, isActive: true }
        });
        if (!user || !user.isActive) {
            return res.status(403).json({ message: "Account is inactive or no longer exists" });
        }
        req.user = { id: user.id, role: user.role };
        next();
    }
    catch (err) {
        next(err);
    }
};

module.exports = auth;
