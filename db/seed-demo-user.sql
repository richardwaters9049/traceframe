\set ON_ERROR_STOP on
\getenv email AUTH_DEMO_EMAIL
\getenv display_name AUTH_DEMO_NAME
\getenv password AUTH_DEMO_PASSWORD

INSERT INTO users (email, display_name, password_hash, role)
VALUES (
  :'email',
  :'display_name',
  crypt(:'password', gen_salt('bf', 12)),
  'analyst'
)
ON CONFLICT (lower(email)) DO UPDATE
SET display_name = EXCLUDED.display_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;
