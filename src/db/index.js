const { Pool } = require('pg');

// Create a new connection pool
// The Pool will automatically read the environment variables 
// (PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT)
// but we'll define them explicitly for clarity.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Export a single query function that all our controllers can use
module.exports = {
  query: (text, params) => pool.query(text, params),
};