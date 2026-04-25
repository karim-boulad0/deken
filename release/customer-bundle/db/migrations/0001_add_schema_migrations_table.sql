-- Records applied SQL migration file names; runner applies missing files in lexical order.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT NOT NULL PRIMARY KEY
);
