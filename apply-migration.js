require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Read migration SQL
    const migrationPath = path.join(__dirname, 'prisma/migrations/1_init/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Applying migration...');
    await client.query(sql);
    console.log('✅ Migration applied successfully!');

    // Verify tables exist
    const result = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
    `);

    console.log(`\n📊 Created ${result.rows.length} tables:`);
    result.rows.forEach(row => console.log(`   • ${row.tablename}`));

    await client.release();
    await pool.end();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
