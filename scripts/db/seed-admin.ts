/**
 * Seed the first admin user from environment fallback credentials.
 * Run once after migration:
 *   set -a && source .env.local && set +a && tsx scripts/db/seed-admin.ts
 *
 * Reads:
 *   ADMIN_EMAIL  (defaults to croman@santarosa.com.py)
 *   ADMIN_PASSWORD (defaults to admin123 — change immediately after login)
 *
 * Idempotent: skips if email already exists.
 */
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'croman@santarosa.com.py';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const fullName = process.env.ADMIN_FULL_NAME || 'Croman Admin';

  const existing = await sql`SELECT id, role FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  if (existing.rows[0]) {
    console.log(`✓ Admin ${email} already exists (id=${existing.rows[0].id}, role=${existing.rows[0].role})`);
    if (existing.rows[0].role !== 'admin') {
      await sql`UPDATE users SET role = 'admin', is_active = true WHERE id = ${existing.rows[0].id}`;
      console.log('  → promoted to admin');
    }
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const r = await sql`
    INSERT INTO users (email, password_hash, full_name, role, is_active)
    VALUES (${email}, ${hash}, ${fullName}, 'admin', true)
    RETURNING id
  `;
  console.log(`✓ Admin created: ${email} (id=${r.rows[0].id})`);
  console.log(`  Password: ${password === 'admin123' ? 'admin123 (CHANGE IT IMMEDIATELY)' : '(custom)'}`);
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
