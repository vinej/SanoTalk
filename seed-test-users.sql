-- ============================================================
-- SanoTalk — Test users seed (3 doctors + 3 pharmacists)
-- IMPORTANT: Generate secure passwords before running:
--   node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(require('crypto').randomBytes(16).toString('hex'),12).then(console.log)"
-- Replace each <HASHED_PASSWORD> below with the output.
-- Never commit real password hashes to this file.
-- DELETE these users when testing is done.
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
INSERT INTO sanotalk_user (id, name, email, email_verified, role, specialty, license_number, two_factor_enabled, created_at, updated_at) VALUES
  ('test-doc-001', 'Dr. Alice Martin',    'alice.martin@test.dev',    true, 'doctor',     'Cardiology',         'LIC-DOC-001', true, NOW(), NOW()),
  ('test-doc-002', 'Dr. Bruno Leclerc',   'bruno.leclerc@test.dev',   true, 'doctor',     'General Medicine',   'LIC-DOC-002', true, NOW(), NOW()),
  ('test-doc-003', 'Dr. Clara Nguyen',    'clara.nguyen@test.dev',    true, 'doctor',     'Pediatrics',         'LIC-DOC-003', true, NOW(), NOW()),
  ('test-pha-001', 'Marie Dupont',        'marie.dupont@test.dev',    true, 'pharmacist', 'Clinical Pharmacy',  'LIC-PHA-001', true, NOW(), NOW()),
  ('test-pha-002', 'Jean-Paul Morin',     'jeanpaul.morin@test.dev',  true, 'pharmacist', 'Hospital Pharmacy',  'LIC-PHA-002', true, NOW(), NOW()),
  ('test-pha-003', 'Sophie Lambert',      'sophie.lambert@test.dev',  true, 'pharmacist', 'Community Pharmacy', 'LIC-PHA-003', true, NOW(), NOW());

-- ── Accounts ─────────────────────────────────────────────────
-- Replace <HASHED_PASSWORD_n> with individually generated bcrypt hashes (cost=12).
-- Never reuse the same password across test accounts.
INSERT INTO sanotalk_account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES
  ('test-acc-doc-001', 'alice.martin@test.dev',   'credential', 'test-doc-001', '<HASHED_PASSWORD_1>', NOW(), NOW()),
  ('test-acc-doc-002', 'bruno.leclerc@test.dev',  'credential', 'test-doc-002', '<HASHED_PASSWORD_2>', NOW(), NOW()),
  ('test-acc-doc-003', 'clara.nguyen@test.dev',   'credential', 'test-doc-003', '<HASHED_PASSWORD_3>', NOW(), NOW()),
  ('test-acc-pha-001', 'marie.dupont@test.dev',   'credential', 'test-pha-001', '<HASHED_PASSWORD_4>', NOW(), NOW()),
  ('test-acc-pha-002', 'jeanpaul.morin@test.dev', 'credential', 'test-pha-002', '<HASHED_PASSWORD_5>', NOW(), NOW()),
  ('test-acc-pha-003', 'sophie.lambert@test.dev', 'credential', 'test-pha-003', '<HASHED_PASSWORD_6>', NOW(), NOW());
