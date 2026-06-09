require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

console.log('Testing connection to:', connectionString.substring(0, 60) + '...');

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Connection error:', err.message);
    console.error('Error code:', err.code);
    pool.end();
    process.exit(1);
  } else {
    console.log('✓ Connected successfully');

    client.query('SELECT NOW()', (err, result) => {
      release();

      if (err) {
        console.error('Query error:', err.message);
        pool.end();
        process.exit(1);
      } else {
        console.log('✓ Query successful');
        console.log('Server time:', result.rows[0].now);
        pool.end();
        process.exit(0);
      }
    });
  }
});

pool.on('error', (err) => {
  console.error('Idle client error:', err);
});
