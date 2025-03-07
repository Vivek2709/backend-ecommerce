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

router.post("/order", verifyToken, isCustomer, async (req, res) => {
    try {
        const cartItems = await pool.query(
            `SELECT c.product_id, c.quantity, p.price 
             FROM cart c 
             JOIN products p ON c.product_id = p.id 
             WHERE c.user_id = $1`,
            [req.user.id]
        );

        if (cartItems.rows.length === 0) {
            return res.status(400).json({ message: "Cart is empty!" });
        }

        let totalPrice = 0;
        const orderItems = cartItems.rows.map((item) => {
            totalPrice += item.price * item.quantity;
            return [item.product_id, item.quantity, item.price];
        });

        // Insert new order
        const newOrder = await pool.query(
            "INSERT INTO orders (user_id, total_price, payment_status, order_status) VALUES ($1, $2, 'pending', 'pending') RETURNING id",
            [req.user.id, totalPrice]
        );
        const orderId = newOrder.rows[0].id;

        // Insert order items
        for (let item of orderItems) {
            await pool.query(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",
                [orderId, ...item]
            );
        }

        // Clear the user's cart
        await pool.query("DELETE FROM cart WHERE user_id = $1", [req.user.id]);

        res.json({ message: "Order placed successfully (COD)", orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/orders", isAdmin || isSeller, async (req, res) => {
    try {
        const orders = await pool.query(
            `SELECT o.id, o.total_price, o.status, o.created_at,
                    json_agg(json_build_object('product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price)) AS items
             FROM orders o
             JOIN order_items oi ON o.id = oi.order_id
             WHERE o.user_id = $1
             GROUP BY o.id`,
            [req.user.id]
        );
        res.json(orders.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
