const axios = require('axios');
const pool = require('./db');
require('dotenv').config();

// Load genre mapping from the JSON file
const genreMapping = require('./movie_genre.json').genres;
const genreMap = genreMapping.reduce((map, genre) => {
  map[genre.id] = genre.name;
  return map;
}, {});

async function searchAndPopulateMovie(movieName) {
  try {
    // Search TMDB for the movie
    const response = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        query: movieName,
        language: 'en-US',
      },
    });

    const movies = response.data.results;

    if (movies.length === 0) {
      console.log(`No movies found in TMDB for "${movieName}".`);
      return null;
    }

    // Use the first result
    const movie = movies[0];
    const { id, overview, title, vote_average, release_date, genre_ids } = movie;

    // Map genre_ids to genre names
    const genres = genre_ids
      .map(id => genreMap[id])
      .filter(Boolean)
      .join(', ');

    // Fetch Cast and Crew details
    const creditsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${id}/credits`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
      },
    });

    const credits = creditsResponse.data;
    const cast = credits.cast.slice(0, 5).map(member => member.name).join(', ');
    const director = credits.crew.find(member => member.job === 'Director')?.name || 'Unknown';

    // Insert the movie into the database
    await pool.query(
      `INSERT INTO Movies (ImdbId, Name, Description, StarCasts, Director, Genre, ReleaseYear, Ratings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        id.toString(),
        title || 'Unknown Title',
        overview || 'No description available',
        cast || 'No star casts available',
        director,
        genres || 'Unknown',
        release_date ? release_date.slice(0, 4) : 'Unknown',
        vote_average / 2,
      ]
    );

    console.log(`Movie "${title}" added to the database.`);
    return movie; // Return the newly fetched movie
  } catch (error) {
    console.error('Error searching TMDB or inserting movie:', error.message);
    return null;
  }
}

module.exports = { searchAndPopulateMovie };
