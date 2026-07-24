'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('ALLOW_SCHEMA_MIGRATION=true is required');
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  const migrationDir = path.join(__dirname, '..', 'migrations');
  if (fs.existsSync(migrationDir)) {
    for (const file of fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()) {
      await pool.query(fs.readFileSync(path.join(migrationDir, file), 'utf8'));
    }
  }
  const email = process.env.PROVISION_ADMIN_EMAIL;
  const password = process.env.PROVISION_ADMIN_PASSWORD;
  const fullName = process.env.PROVISION_ADMIN_NAME || 'Runtime Administrator';
  if (!email || !password) throw new Error('Provisioned administrator credentials are required');
  const [firstName, ...lastParts] = fullName.split(/\s+/);
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users(email,password,first_name,last_name,role) VALUES($1,$2,$3,$4,'admin')
     ON CONFLICT(email) DO UPDATE SET password=EXCLUDED.password,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,role='admin'`,
    [email, hash, firstName, lastParts.join(' ') || 'Administrator']
  );
}

main().then(() => pool.end()).catch(async (error) => {
  console.error(error.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
