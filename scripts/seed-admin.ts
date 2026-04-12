/**
 * Seed an admin account into the auth_users table.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Override defaults via env vars:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme npx tsx scripts/seed-admin.ts
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, scryptSync } from 'node:crypto';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@ringbooker.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'AnhDung123@4!';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

// ─── Password hashing (matches src/backend/security/password.ts) ─────────────

const KEY_LEN = 64;
const SALT_LEN = 16;

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check if admin already exists
  const { data: existing, error: findError } = await supabase
    .from('auth_users')
    .select('id, email, role')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (findError) {
    console.error('❌  Error querying auth_users:', findError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(`⚠️  Admin account already exists: ${existing.email} (id: ${existing.id}, role: ${existing.role})`);
    console.log('   Run with a different ADMIN_EMAIL to create another, or update manually in Supabase dashboard.');
    process.exit(0);
  }

  const passwordHash = hashPassword(ADMIN_PASSWORD);

  const { data: created, error: insertError } = await supabase
    .from('auth_users')
    .insert({
      email: ADMIN_EMAIL,
      role: 'admin',
      shop_id: null,
      password_hash: passwordHash,
      active: true,
      mfa_enabled: false,
    })
    .select('id, email, role')
    .single();

  if (insertError) {
    console.error('❌  Failed to create admin account:', insertError.message);
    process.exit(1);
  }

  console.log('✅  Admin account created successfully!');
  console.log(`   ID:    ${created.id}`);
  console.log(`   Email: ${created.email}`);
  console.log(`   Role:  ${created.role}`);
  console.log('');
  console.log('⚠️  Remember to change the password after first login if using the default.');
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
