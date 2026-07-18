\set ON_ERROR_STOP on

INSERT INTO users (email, display_name, password_hash, role)
VALUES (
  :'email',
  :'display_name',
  crypt(:'password', gen_salt('bf', 12)),
  'analyst'
)
ON CONFLICT (email) DO UPDATE
SET display_name = EXCLUDED.display_name;
