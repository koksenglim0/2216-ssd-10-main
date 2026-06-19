const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z0-9_$]+$/.test(identifier)) {
    throw new Error('DB_NAME may only contain letters, numbers, underscore, or dollar sign.');
  }
  return `\`${identifier}\``;
}

function splitSqlScript(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = '';

  for (const line of sql.split(/\r?\n/)) {
    const delimiterMatch = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (delimiterMatch) {
      if (buffer.trim()) {
        statements.push(buffer.trim());
        buffer = '';
      }
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += `${line}\n`;

    const trimmed = buffer.trimEnd();
    if (trimmed.endsWith(delimiter)) {
      const statement = trimmed.slice(0, -delimiter.length).trim();
      if (statement) statements.push(statement);
      buffer = '';
    }
  }

  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    throw new Error('Usage: node scripts/run-sql.js sql/001_schema.sql');
  }

  const absolutePath = path.resolve(process.cwd(), sqlFile);
  const dbName = process.env.DB_NAME || 'sitwallet';
  const quotedDbName = quoteIdentifier(dbName);
  const sql = fs.readFileSync(absolutePath, 'utf8')
    .replace(
      /CREATE DATABASE IF NOT EXISTS sitwallet\s+CHARACTER SET/i,
      `CREATE DATABASE IF NOT EXISTS ${quotedDbName}\n  CHARACTER SET`
    )
    .replace(/USE sitwallet;/i, `USE ${quotedDbName};`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    for (const statement of splitSqlScript(sql)) {
      await connection.query(statement);
    }
    console.log(`Applied ${sqlFile}`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { quoteIdentifier, splitSqlScript };
