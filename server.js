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

// Middleware to parse request body
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
        res.status(201).send(`User created with UID: ${newUserId}`);
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

        res.status(200).send(`Welcome back, ${username}!`);
    } catch (err) {
        console.error("Error checking user:", err.message);
        res.status(500).send("Failed to check user.");
    }
});

// Search our DB for presaved movie
app.post('/search', async (req, res) => {
    const { movieName } = req.body;
  
    if (!movieName) {
      console.error("Search error: Movie name is missing.");
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
        console.log("Movies found in the local database:", result.rows);
        return res.status(200).json({ movies: result.rows });
      }
  
      console.log(`Movie "${movieName}" not found locally. Searching TMDB...`);
  
      const baseURL = process.env.SERVER_BASE_URL || `http://localhost:${port}`;
      const tmdbResponse = await axios.post(`${baseURL}/searchNewMovies`, { movieName });
      const tmdbMovie = tmdbResponse.data.movies[0];
  
      if (!tmdbMovie) {
        console.log(`No movie found in TMDB for "${movieName}".`);
        return res.status(404).json({ message: 'No movies found.' });
      }
  
      console.log(`Movie "${tmdbMovie.title}" added to the database. Rechecking local database...`);
  
      const strictQuery = `
        SELECT *
        FROM Movies
        WHERE ImdbId = $1
      `;
      const exactValues = [tmdbMovie.id.toString()];
  
      const newResult = await pool.query(strictQuery, exactValues);
  
      if (newResult.rows.length > 0) {
        return res.status(200).json({ movies: newResult.rows });
      }
  
      console.error("Movie added to the database but could not be retrieved.");
      return res.status(500).json({ message: 'Error retrieving movie after adding it to the database.' });
  
    } catch (err) {
      console.error('Error during search:', err.message);
      res.status(500).json({ message: 'Error searching for movies.' });
    }
});  
  
// Search TMDB for a movie
app.post('/searchNewMovies', async (req, res) => {
  const { movieName } = req.body;

  if (!movieName) {
    console.error("Search error: Movie name is missing.");
    return res.status(400).json({ message: 'Movie name is required.' });
  }

  const movie = await searchAndPopulateMovie(movieName);

  console.log(movie);

  if (!movie) {
    return res.status(404).json({ message: 'No movies found in TMDB.' });
  }

  return res.status(200).json({ movies: [movie] });
});


// Add a Movie Review
app.post("/review", async (req, res) => {
    const { uid, movieId, review, rating } = req.body;

    if (!uid || !movieId || !review || rating === undefined) {
        return res.status(400).send("All fields (UID, movieId, review, rating) are required.");
    }

    try {
        const query = `
            INSERT INTO Reviews (UID, ImdbId, Contents, Ratings)
            VALUES ($1, $2, $3, $4)
        `;
        await pool.query(query, [uid, movieId, review, rating]);

        res.status(200).send("Review added successfully.");
    } catch (err) {
        console.error("Error adding review:", err.message);
        res.status(500).send("Failed to add review.");
    }
});

// Start the server
app.listen(port, '::', () => {
    console.log(`Server is running on http://localhost:${port}`);
});
