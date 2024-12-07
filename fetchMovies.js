const axios = require('axios');
const pool = require('./db');
require('dotenv').config();

// Load genre mapping from the JSON file
const genreMapping = require('./movie_genre.json').genres;
const genreMap = genreMapping.reduce((map, genre) => {
  map[genre.id] = genre.name;
  return map;
}, {});

async function fetchAndPopulateMovies() {
  try {
    const response = await axios.get(`https://api.themoviedb.org/3/movie/popular`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        language: 'en-US',
        page: 1, // Fetch the first page
      },
    });

    const movies = response.data.results.slice(0, 50); // Limit to 50 entries

    for (const movie of movies) {
      const { id, overview, title, vote_average, release_date, genre_ids } = movie;

      // Map genre_ids to genre names
      const genres = genre_ids
        .map(id => genreMap[id]) // Map each genre_id to genre name
        .filter(Boolean) // Remove undefined values
        .join(', ');

      // Fetch Cast and Crew details
      const creditsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${id}/credits`, {
        params: {
          api_key: process.env.TMDB_API_KEY,
        },
      });

      const credits = creditsResponse.data;
      const cast = credits.cast.slice(0, 5).map(member => member.name).join(', '); // First 5 cast members
      const director = credits.crew.find(member => member.job === 'Director')?.name || 'Unknown';

      await pool.query(
        `INSERT INTO Movies (ImdbId, Name, Description, StarCasts, Director, Genre, ReleaseYear, Ratings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          id.toString(), 
          title || 'Unknown Title', // Added title for Name column
          overview || 'No description available', 
          cast || 'No star casts available', 
          director, 
          genres || 'Unknown',
          release_date ? release_date.slice(0, 4) : 'Unknown',
          vote_average / 2, // Normalize to 0-5 scale
        ]
      );
    }

    console.log('Database populated with movies, cast, and director.');
  } catch (error) {
    console.error('Error fetching or inserting movies:', error.message);
  } finally {
    pool.end();
  }
}

fetchAndPopulateMovies();
