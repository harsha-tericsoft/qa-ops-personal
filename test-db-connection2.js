require('dotenv').config();
const { Pool } = require('pg');

// Test with transformed URL (supabase.co instead of pooler)
const dbUrl = process.env.DATABASE_URL;
const connectionString = dbUrl.includes('pooler.supabase.com')
  ? dbUrl.replace('pooler.supabase.com', 'supabase.co').replace(':6543', ':5432').replace('?pgbouncer=true', '')
  : dbUrl;

console.log('Testing with regular Supabase URL:', connectionString.substring(0, 70) + '...');

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
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
