const axios = require('axios');
const express = require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse request body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure the database table exists
const initializeDb = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS users (
            uid SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE
        )
    `;
    try {
        await pool.query(query);
        console.log("Users table ensured.");
    } catch (err) {
        console.error("Error initializing database:", err.message);
    }
};

initializeDb();

// Redirect the root URL to login.html
app.get("/", (req, res) => {
    res.redirect("/login.html");
});


app.post("/signup", async (req, res) => {
    //console.log("Request body:", req.body); 
    const { username } = req.body;

    if (!username) {
        return res.status(400).send("Username is required.");
    }

    try {
        // Check if the username already exists
        const checkQuery = `SELECT uid FROM users WHERE username = $1`;
        const checkResult = await pool.query(checkQuery, [username]);

        if (checkResult.rows.length > 0) {
            return res.status(409).send("Username already exists."); // 409 Conflict
        }

        // Insert new user if username is not taken
        const insertQuery = `INSERT INTO users (username) VALUES ($1) RETURNING uid`;
        const insertResult = await pool.query(insertQuery, [username]);

        const newUserId = insertResult.rows[0].uid;
        res.status(201).send(`User created with UID: ${newUserId}`);
    } catch (err) {
        console.error("Error inserting user:", err.message);
        res.status(500).send("Failed to add user.");
    }
});


app.post("/login", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send("Username is required.");
    }

    try {
        // Check if the user exists
        const query = `SELECT uid FROM users WHERE username = $1`;
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            // User does not exist
            return res.status(404).send("User not found. Please create an account.");
        }

        // User exists
        res.status(200).send(`Welcome back, ${username}!`);
    } catch (err) {
        console.error("Error checking user:", err.message);
        res.status(500).send("Failed to check user.");
    }
});

app.post('/search', async (req, res) => {
    const { movieName } = req.body;

    if (!movieName) {
        return res.status(400).json({ message: 'Movie name is required.' });
    }

    try {
        const query = `
            SELECT *
            FROM Movies
            WHERE LOWER(Description) LIKE LOWER($1) OR LOWER(ImdbId) LIKE LOWER($1)
        `;
        const values = [`%${movieName}%`]; // Wildcard for partial matches

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No movies found.' });
        }

        res.status(200).json({ movies: result.rows });
    } catch (err) {
        console.error('Error searching movies:', err.message);
        res.status(500).json({ message: 'Error searching for movies.' });
    }
});


// Start the server
app.listen(port,'0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});