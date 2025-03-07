const jwt = require("jsonwebtoken");
require("dotenv").config();

const verifyToken = (req, res, next) => {
    const token = req.header("Authorization");

    if (!token) {
        return res
            .status(401)
            .json({ message: "Access Denied: No Token Provided" });
    }

    try {
        const decoded = jwt.verify(
            token.replace("Bearer ", ""),
            process.env.JWT_SECRET
        );
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: "Invalid Token" });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access Denied: Admins Only" });
    }
    next();
};

const isSeller = (req, res, next) => {
    if (req.user.role !== "seller") {
        return res.status(403).json({ message: "Access Denied: Sellers Only" });
    }
    next();
};

const isCustomer = (req, res, next) => {
    if (req.user.role !== "customer") {
        return res
            .status(403)
            .json({ message: "Access Denied: Customers Only" });
    }
    next();
};

module.exports = { verifyToken, isAdmin, isSeller, isCustomer };
