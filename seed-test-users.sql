-- ============================================================
-- SanoTalk — Test users seed (3 doctors + 3 pharmacists)
-- Password for all: 12345
-- DELETE these users when testing is done.
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
INSERT INTO sanotalk_user (id, name, email, email_verified, role, specialty, license_number, two_factor_enabled, created_at, updated_at) VALUES
  ('test-doc-001', 'Dr. Alice Martin',    'alice.martin@test.dev',    true, 'doctor',     'Cardiology',         'LIC-DOC-001', false, NOW(), NOW()),
  ('test-doc-002', 'Dr. Bruno Leclerc',   'bruno.leclerc@test.dev',   true, 'doctor',     'General Medicine',   'LIC-DOC-002', false, NOW(), NOW()),
  ('test-doc-003', 'Dr. Clara Nguyen',    'clara.nguyen@test.dev',    true, 'doctor',     'Pediatrics',         'LIC-DOC-003', false, NOW(), NOW()),
  ('test-pha-001', 'Marie Dupont',        'marie.dupont@test.dev',    true, 'pharmacist', 'Clinical Pharmacy',  'LIC-PHA-001', false, NOW(), NOW()),
  ('test-pha-002', 'Jean-Paul Morin',     'jeanpaul.morin@test.dev',  true, 'pharmacist', 'Hospital Pharmacy',  'LIC-PHA-002', false, NOW(), NOW()),
  ('test-pha-003', 'Sophie Lambert',      'sophie.lambert@test.dev',  true, 'pharmacist', 'Community Pharmacy', 'LIC-PHA-003', false, NOW(), NOW());

-- ── Accounts (credential provider, password = "12345") ───────
INSERT INTO sanotalk_account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES
  ('test-acc-doc-001', 'alice.martin@test.dev',   'credential', 'test-doc-001', 'bb3166e15b6e67f303cdca4cc5ad1af1:5575dea0df8508866c1b73a4311f7779a70e03b1765cd25ffe59625707c6579b623f726b3873d66bcd8502a426ef14139f88949a1e35c394e566a1b9b02e5744', NOW(), NOW()),
  ('test-acc-doc-002', 'bruno.leclerc@test.dev',  'credential', 'test-doc-002', '1645e0159bbeafbfd89777a54eab808c:110f01af17fd87dd7f02370ddff15ac89b0874c3134af5ea13e993f5e73bccc2b1f02bc9440445c53a90be5480a77b3044510f3cf359f90bf1324acfa0a0f93b', NOW(), NOW()),
  ('test-acc-doc-003', 'clara.nguyen@test.dev',   'credential', 'test-doc-003', '8c8cf9b6660eb93ca4f0e471b4eb6769:81345303c1a568b3f3867782f4e0e07ef10d6c9cc67ec381314b5cce7b32956a261fdd6b7ccedf9350469bbd132f1dcbf7f204f33b0a3d75d39f68c766113987', NOW(), NOW()),
  ('test-acc-pha-001', 'marie.dupont@test.dev',   'credential', 'test-pha-001', 'fe2281bba596a95eb955e6c2cf4b537f:5b56e99f427904d7396d834cffbaef5bbc2eac97452ba6cb3068670c4c2f3e454d1d2daf85d5495eb7631efb6e167c78eb366fafc35655aab1dbdadedd7f41d4', NOW(), NOW()),
  ('test-acc-pha-002', 'jeanpaul.morin@test.dev', 'credential', 'test-pha-002', '935fab4e4926faf243acc90fa0403548:af013cc3ebbe62e84e7627fbd887f5ac498ab16bf5e2521ce4f2ba24f6102ecea75fd518d1d73f30afe22805ac2d6a689fb5e3a04c4c7ef16b1f5f02cb3d8036', NOW(), NOW()),
  ('test-acc-pha-003', 'sophie.lambert@test.dev', 'credential', 'test-pha-003', '41a79229585b0b756116ea9b52115ac4:d914c770cbbf21c93a023145280c3d6b2fda82a398b83b54ff7dac9445b2d2c42c9c9a5d7be28591840cd7b5aa83ceb6d786fdc72b9678e40f551576c5ee188f', NOW(), NOW());
