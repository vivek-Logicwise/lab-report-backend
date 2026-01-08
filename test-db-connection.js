/**
 * Simple Database Connection Test
 * Run with: node test-db-connection.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const config = {
  host: process.env.DB_HOST || '34.55.228.77',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'BurakPrecision',
  user: process.env.DB_USER || 'vivek',
  password: process.env.DB_PASSWORD || '{-cUD3p_Z7.zPr"&',
  connectionTimeoutMillis: 5000 // 5 second timeout
};

console.log('\n' + '='.repeat(60));
console.log('Testing PostgreSQL Connection');
console.log('='.repeat(60));
console.log('Host:', config.host);
console.log('Port:', config.port);
console.log('Database:', config.database);
console.log('User:', config.user);
console.log('='.repeat(60) + '\n');

const pool = new Pool(config);

async function test() {
  let client;
  try {
    console.log('⏳ Connecting...');
    client = await pool.connect();
    
    console.log('✅ Connected successfully!\n');
    
    const result = await client.query(`
      SELECT 
        NOW() as current_time,
        current_database() as database,
        version() as pg_version
    `);
    
    console.log('📊 Connection Details:');
    console.log('  Time:', result.rows[0].current_time);
    console.log('  Database:', result.rows[0].database);
    console.log('  Version:', result.rows[0].pg_version.substring(0, 50) + '...');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! Your database connection is working!');
    console.log('='.repeat(60) + '\n');
    console.log('You can now run: npm start\n');
    
    client.release();
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.log('❌ Connection failed!\n');
    console.log('Error:', error.message);
    console.log('Code:', error.code);
    console.log('\n' + '='.repeat(60));
    console.log('Troubleshooting:');
    console.log('='.repeat(60));
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.log('\n🔒 Firewall/Network Issue:');
      console.log('Your IP is not authorized to connect to Cloud SQL.\n');
      console.log('Solution:');
      console.log('1. Get your IP: (Invoke-WebRequest -Uri "https://api.ipify.org").Content');
      console.log('2. Add to Cloud SQL authorized networks');
      console.log('3. See QUICKSTART.md for detailed steps\n');
    } else if (error.code === '28P01') {
      console.log('\n🔐 Authentication Issue:');
      console.log('Username or password is incorrect.\n');
      console.log('Check your .env file:\n');
      console.log('  DB_USER=vivek');
      console.log('  DB_PASSWORD={-cUD3p_Z7.zPr"&\n');
    } else {
      console.log('\n❓ Unknown error. Check:');
      console.log('  - Database host is correct: 34.55.228.77');
      console.log('  - Database port is correct: 5432');
      console.log('  - Cloud SQL instance is running');
      console.log('  - Network connectivity\n');
    }
    
    console.log('For detailed help, see: CLOUD_SQL_SETUP.md\n');
    
    if (client) client.release();
    await pool.end();
    process.exit(1);
  }
}

test();
