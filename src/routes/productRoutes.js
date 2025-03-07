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

router.post("/products", verifyToken, isSeller || isAdmin, async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        const newProduct = await pool.query(
            "INSERT INTO products (name, description, price, stock, seller_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [name, description, price, stock, req.user.id]
        );

        res.status(201).json(newProduct.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.get("/products", verifyToken, async (req, res) => {
    try {
        const products = await pool.query("SELECT * FROM products");
        res.json(products.rows);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

router.get(
    "/seller/products",
    verifyToken,
    isSeller || isAdmin,
    async (req, res) => {
        try {
            const products = await pool.query(
                "SELECT * FROM products WHERE seller_id = $1",
                [req.user.id]
            );
            res.json(products.rows);
        } catch (err) {
            res.status(500).json({
                message: "Server error",
                error: err.message,
            });
        }
    }
);

router.put(
    "/products/:id",
    verifyToken,
    isSeller || isAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, price, stock } = req.body;

            // Check if the product belongs to the seller
            const product = await pool.query(
                "SELECT * FROM products WHERE id = $1 AND seller_id = $2",
                [id, req.user.id]
            );
            if (product.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Product not found or you don’t have permission to edit it",
                });
            }

            // Update product
            const updatedProduct = await pool.query(
                "UPDATE products SET name = $1, description = $2, price = $3, stock = $4 WHERE id = $5 RETURNING *",
                [
                    name || product.rows[0].name,
                    description || product.rows[0].description,
                    price || product.rows[0].price,
                    stock || product.rows[0].stock,
                    id,
                ]
            );

            res.json(updatedProduct.rows[0]);
        } catch (err) {
            res.status(500).json({
                message: "Server error",
                error: err.message,
            });
        }
    }
);

router.delete(
    "/products/:id",
    verifyToken,
    isSeller || isAdmin,
    async (req, res) => {
        try {
            if (req.user.role !== "seller") {
                return res
                    .status(403)
                    .json({ message: "Only sellers can delete products" });
            }

            const { id } = req.params;

            // Check if the product belongs to the seller
            const product = await pool.query(
                "SELECT * FROM products WHERE id = $1 AND seller_id = $2",
                [id, req.user.id]
            );
            if (product.rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Product not found or you don’t have permission to delete it",
                });
            }

            await pool.query("DELETE FROM products WHERE id = $1", [id]);
            res.json({ message: "Product deleted successfully" });
        } catch (err) {
            res.status(500).json({
                message: "Server error",
                error: err.message,
            });
        }
    }
);

// Update Order Status (Admin/Seller)
router.put("/order/:orderId/status", isAdmin || isSeller, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { order_status } = req.body;

        const updatedOrder = await pool.query(
            "UPDATE orders SET order_status = $1 WHERE id = $2 RETURNING *",
            [order_status, orderId]
        );

        if (updatedOrder.rows.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json({
            message: "Order status updated",
            order: updatedOrder.rows[0],
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
