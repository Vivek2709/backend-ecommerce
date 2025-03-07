const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../../db"); // Import DB connection
const {
    isAdmin,
    verifyToken,
    isSeller,
    isCustomer,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", verifyToken, isCustomer, async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        if (!product_id || quantity <= 0) {
            return res
                .status(400)
                .json({ message: "Invalid product ID or quantity" });
        }

        // Check if product exists
        const product = await pool.query(
            "SELECT * FROM products WHERE id = $1",
            [product_id]
        );
        if (product.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if the product is already in the cart
        const existingCartItem = await pool.query(
            "SELECT * FROM cart WHERE user_id = $1 AND product_id = $2",
            [req.user.id, product_id]
        );

        if (existingCartItem.rows.length > 0) {
            // Update quantity if already in cart
            await pool.query(
                "UPDATE cart SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3",
                [quantity, req.user.id, product_id]
            );
        } else {
            // Insert new cart item
            await pool.query(
                "INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)",
                [req.user.id, product_id, quantity]
            );
        }

        res.json({ message: "Product added to cart successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.get("/", verifyToken, async (req, res) => {
    try {
        if (req.user.role !== "customer") {
            return res
                .status(403)
                .json({ message: "Only customers can view cart" });
        }

        const cartItems = await pool.query(
            `SELECT c.id, p.name, p.price, c.quantity, (p.price * c.quantity) AS total_price
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = $1`,
            [req.user.id]
        );

        res.json(cartItems.rows);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.put("/update/:id", verifyToken, isCustomer, async (req, res) => {
    try {
        const { id } = req.params; // Cart item ID
        const { quantity } = req.body;

        if (quantity <= 0) {
            return res
                .status(400)
                .json({ message: "Quantity must be greater than zero" });
        }

        // Check if the cart item exists
        const cartItem = await pool.query(
            "SELECT * FROM cart WHERE id = $1 AND user_id = $2",
            [id, req.user.id]
        );
        if (cartItem.rows.length === 0) {
            return res.status(404).json({ message: "Cart item not found" });
        }

        // Update quantity
        await pool.query("UPDATE cart SET quantity = $1 WHERE id = $2", [
            quantity,
            id,
        ]);

        res.json({ message: "Cart updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.delete("/remove/:id", verifyToken, isCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const cartItem = await pool.query(
            "SELECT * FROM cart WHERE id = $1 AND user_id = $2",
            [id, req.user.id]
        );
        if (cartItem.rows.length === 0) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        await pool.query("DELETE FROM cart WHERE id = $1", [id]);

        res.json({ message: "Item removed from cart successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
