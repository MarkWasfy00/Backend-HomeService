/**
 * `sslmode` means two different things depending on who reads the URL.
 *
 * Prisma's own tooling - Studio, migrate, the schema engine - follows libpq,
 * where `require` means "encrypt, but do not check the certificate".
 * node-postgres, which is what our driver adapter runs on, treats `require` as
 * `verify-full` instead and refuses a self-signed certificate. So one URL
 * cannot satisfy both: `sslmode=require` breaks the app, and node-postgres'
 * own `sslmode=no-verify` is not a real libpq mode, so it breaks Studio.
 *
 * DATABASE_URL is therefore written the libpq way - that is the standard, and
 * it is what the CLI needs - and this function translates it for pg. The
 * parameter has to be *removed* from the string rather than overridden,
 * because pg gives whatever it parses out of the connection string priority
 * over the options you hand it.
 */

type PgSsl = boolean | { rejectUnauthorized: boolean };

export type PgConnectionConfig = {
  connectionString: string;
  ssl?: PgSsl;
};

export function pgConnectionConfig(databaseUrl: string): PgConnectionConfig {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");

  const connectionString = url.toString();

  switch (sslmode) {
    // Encrypt, but do not verify the certificate - what a server with a
    // self-signed certificate needs. (`prefer` should fall back to plaintext;
    // insisting on TLS is the safer reading of it.)
    case "require":
    case "prefer":
    // node-postgres' own spelling of the same thing, accepted so that a URL
    // copied from a node-postgres project keeps working.
    case "no-verify":
      return { connectionString, ssl: { rejectUnauthorized: false } };

    // Check the certificate chain properly. This is what production should
    // use, against a database with a certificate from a real CA.
    case "verify-ca":
    case "verify-full":
      return { connectionString, ssl: { rejectUnauthorized: true } };

    case "disable":
      return { connectionString, ssl: false };

    // No sslmode at all: leave pg on its default of no TLS, which is what the
    // local postgres from docker-compose expects.
    default:
      return { connectionString };
  }
}
