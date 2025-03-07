const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../../db"); // Import DB connection
const { isAdmin, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
router.post(
    "/register",
    [
        body("name").notEmpty().withMessage("Name is required"),
        body("email").isEmail().withMessage("Valid email is required"),
        body("password")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        const { name, email, password, role } = req.body;

        try {
            // Check if user exists
            const userExists = await pool.query(
                "SELECT * FROM users WHERE email = $1",
                [email]
            );
            if (userExists.rows.length > 0) {
                return res.status(400).json({ error: "User already exists" });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            const newUser = await pool.query(
                "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
                [name, email, hashedPassword, role || "customer"]
            );

            // Generate JWT token
            const token = jwt.sign(
                { id: newUser.rows[0].id, role: newUser.rows[0].role },
                JWT_SECRET,
                {
                    expiresIn: "1h",
                }
            );

            res.status(201).json({
                message: "User registered successfully",
                token,
                user: {
                    id: newUser.rows[0].id,
                    name: newUser.rows[0].name,
                    email: newUser.rows[0].email,
                    role: newUser.rows[0].role,
                },
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

router.post(
    "/login",
    [
        body("email").isEmail().withMessage("Valid email is required"),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        const { email, password } = req.body;

        try {
            // Find user
            const user = await pool.query(
                "SELECT * FROM users WHERE email = $1",
                [email]
            );
            if (user.rows.length === 0) {
                return res.status(400).json({ error: "Invalid credentials" });
            }
            const isMatch = await bcrypt.compare(
                password,
                user.rows[0].password
            );
            if (!isMatch)
                return res.status(400).json({ error: "Invalid credentials" });
            const token = jwt.sign(
                { id: user.rows[0].id, role: user.rows[0].role },
                JWT_SECRET,
                {
                    expiresIn: "1h",
                }
            );
            res.json({ message: "Login successful", token });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
);

router.get("/admin", verifyToken, isAdmin, (req, res) => {
    res.json({ message: "Welcome, Admin!" });
});

module.exports = router;
