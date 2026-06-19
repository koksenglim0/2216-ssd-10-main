const mysql = require('mysql2/promise');
const { env } = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  namedPlaceholders: false,
  decimalNumbers: false,
  timezone: 'Z'
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function rawQuery(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function callProcedure(name, params = []) {
  const placeholders = params.map(() => '?').join(', ');
  const rows = await rawQuery(`CALL ${name}(${placeholders})`, params);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, rawQuery, callProcedure, closePool };
