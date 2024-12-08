const axios = require('axios');
const express = require("express");
const bodyParser = require("body-parser");
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();
const path = require('path');
const { searchAndPopulateMovie } = require('./searchForNewMovie');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure the database tables exist
const initializeDb = async () => {
    const queries = [
        `
        CREATE TABLE IF NOT EXISTS Users (
            UID SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS Movies (
            ImdbId VARCHAR(32) PRIMARY KEY,
            Name VARCHAR(255) NOT NULL,
            Description VARCHAR(4000),
            StarCasts VARCHAR(200) NOT NULL,
            Director VARCHAR(100) NOT NULL,
            Genre VARCHAR(250) NOT NULL,
            ReleaseYear CHAR(4) NOT NULL,
            Ratings REAL NOT NULL,
            CHECK (Ratings >= 0.0 AND Ratings <= 5.0)
        )
        `,
        `
        CREATE TABLE IF NOT EXISTS Reviews (
            ReviewID SERIAL PRIMARY KEY,
            UID INT NOT NULL,
            ImdbId VARCHAR(32),
            Contents VARCHAR(250),
            Ratings REAL NOT NULL,
            FOREIGN KEY (UID) REFERENCES Users (UID),
            FOREIGN KEY (ImdbId) REFERENCES Movies (ImdbId),
            CHECK (Ratings >= 0.0 AND Ratings <= 5.0)
        )
        `
    ];

    try {
        for (const query of queries) {
            await pool.query(query);
        }
        console.log("Database tables ensured.");
    } catch (err) {
        console.error("Error initializing database:", err.message);
    }
};

initializeDb();

// Redirect the root URL to login.html
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

// User Signup
app.post("/signup", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send("Username is required.");
    }

    try {
        const checkQuery = `SELECT UID FROM Users WHERE username = $1`;
        const checkResult = await pool.query(checkQuery, [username]);

        if (checkResult.rows.length > 0) {
            return res.status(409).send("Username already exists.");
        }

        const insertQuery = `INSERT INTO Users (username) VALUES ($1) RETURNING UID`;
        const insertResult = await pool.query(insertQuery, [username]);

        const newUserId = insertResult.rows[0].uid;
        res.status(201).json({
            message: "User created successfully!",
            uid: newUserId
        }); // Return the UID in the response
    } catch (err) {
        console.error("Error inserting user:", err.message);
        res.status(500).send("Failed to add user.");
    }
});


// User Login
app.post("/login", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).send("Username is required.");
    }

    try {
        const query = `SELECT UID FROM Users WHERE username = $1`;
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(404).send("User not found. Please create an account.");
        }

        const uid = result.rows[0].uid; // Extract UID from the query result
        res.status(200).json({ message: `Welcome back, ${username}!`, uid }); // Return UID in response
    } catch (err) {
        console.error("Error checking user:", err.message);
        res.status(500).send("Failed to check user.");
    }
});

// Search movies in the database or TMDB
app.post('/search', async (req, res) => {
    const { movieName } = req.body;

    if (!movieName) {
        return res.status(400).json({ message: 'Movie name is required.' });
    }

    try {
        const query = `
            SELECT *
            FROM Movies
            WHERE LOWER(Name) LIKE LOWER($1)
        `;
        const values = [`%${movieName}%`];
        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            return res.status(200).json({ movies: result.rows });
        }

        console.log(`Movie "${movieName}" not found locally. Searching TMDB...`);
        const movie = await searchAndPopulateMovie(movieName);

        if (!movie) {
            return res.status(404).json({ message: 'No movies found.' });
        }

        const updatedResult = await pool.query(
            `SELECT * FROM Movies WHERE ImdbId = $1`,
            [movie.id.toString()]
        );

        if (updatedResult.rows.length > 0) {
            return res.status(200).json({ movies: updatedResult.rows });
        }

        return res.status(500).json({ message: 'Error retrieving movie after adding it to the database.' });
    } catch (err) {
        console.error('Error during search:', err.message);
        res.status(500).json({ message: 'Error searching for movies.' });
    }
});

// Add a Movie Review
app.post("/review", async (req, res) => {
    const { uid, movieId, review, rating } = req.body;

    // Debugging logs to track received data
    console.log("Received data:", { uid, movieId, review, rating });

    if (!uid || !movieId || !review || rating === undefined) {
        console.error("Missing required fields: UID, movieId, review, rating.");
        return res.status(400).send("All fields (UID, movieId, review, rating) are required.");
    }

    try {
        // Debugging log to check query being executed
        const query = `
            INSERT INTO Reviews (UID, ImdbId, Contents, Ratings)
            VALUES ($1, $2, $3, $4)
        `;
        console.log("Executing query:", query);
        console.log("Query parameters:", [uid, movieId, review, rating]);

        // Execute the query
        await pool.query(query, [uid, movieId, review, rating]);

        console.log("Review added successfully.");
        res.status(200).send("Review added successfully.");
    } catch (err) {
        console.error("Error adding review:", err.message);
        // Additional error details for debugging
        console.error("Error details:", err);
        res.status(500).send("Failed to add review.");
    }
});

// Start the server
app.listen(port, '::', () => {
    console.log(`Server is running on http://localhost:${port}`);
});
