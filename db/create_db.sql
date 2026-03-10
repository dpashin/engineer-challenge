-- PostgreSQL 17 script to create auth database and user
-- Run this as a superuser (e.g., postgres)

-- Create the auth user with a password
CREATE USER auth WITH PASSWORD 'auth_password';

-- Create the auth database owned by the auth user
CREATE DATABASE auth OWNER auth;

-- Grant all privileges on the database to the auth user
GRANT ALL PRIVILEGES ON DATABASE auth TO auth;
