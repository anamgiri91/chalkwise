-- Review and execute separately, before 001_initial.sql.
-- Credentials belong in Secrets Manager, not in this file.
CREATE ROLE chalkwise_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
-- Create a distinct LOGIN role using your approved credential provisioning process,
-- then GRANT chalkwise_app TO that login. Never grant the migration role to it.
