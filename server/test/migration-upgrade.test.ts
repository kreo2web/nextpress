import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";

const folder = new URL("../../migrations/", import.meta.url);
const readMigration = (name: string): string => readFileSync(new URL(name, folder), "utf8");
const authMigration = readMigration("0002_better_auth_and_multi_site.sql");

async function createOldDatabase(): Promise<PGlite> {
	const db = new PGlite();
	await db.exec(readMigration("0000_numerous_zodiak.sql"));
	await db.exec(readMigration("0001_cold_bloodstorm.sql"));
	await db.exec(`
		INSERT INTO users (id, username, email, password) VALUES
		('00000000-0000-4000-8000-000000000001', 'owner', 'owner@example.com', 'keep-password');
		INSERT INTO sites (id, owner_id, is_default) VALUES
		('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', true);
		INSERT INTO options (name, value) VALUES ('keep-option', 'keep-value');
	`);
	return db;
}

describe("upgrading an older installation", () => {
	it("applies the complete migration chain on a fresh database and reruns cleanly", async () => {
		const db = new PGlite();
		try {
			await migrate(drizzle(db), { migrationsFolder: folder.pathname });
			await migrate(drizzle(db), { migrationsFolder: folder.pathname });
			const result = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
			expect(result.rows[0]?.count).toBe(13);
		} finally {
			await db.close();
		}
	}, 60_000);

	it.each(["columns", "all objects"])("preserves data when auth %s already exist but migration is pending", async (existing) => {
		const db = await createOldDatabase();
		try {
			if (existing === "all objects") {
				await db.exec(authMigration);
			} else {
				await db.exec(`ALTER TABLE users ADD COLUMN name varchar;
					ALTER TABLE users ADD COLUMN email_verified boolean DEFAULT false NOT NULL;
					ALTER TABLE users ADD COLUMN display_username varchar;`);
			}
			await db.exec("UPDATE users SET name = 'Keep Name', email_verified = true, display_username = 'KeepOwner'");
			// Record only the original migrations, as on an install awaiting 0002.
			const journal = JSON.parse(readMigration("meta/_journal.json")) as { entries: { when: number }[] };
			await db.exec('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)');
			await db.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', ["old", journal.entries[1]!.when]);
			await migrate(drizzle(db), { migrationsFolder: folder.pathname });
			await migrate(drizzle(db), { migrationsFolder: folder.pathname });
			await db.exec(authMigration);
			const users = await db.query("SELECT username, password, name, email_verified, display_username FROM users");
			expect(users.rows).toEqual([{ username: "owner", password: "keep-password", name: "Keep Name", email_verified: true, display_username: "KeepOwner" }]);
			const options = await db.query("SELECT value, site_id FROM options WHERE name = 'keep-option'");
			expect(options.rows).toEqual([{ value: "keep-value", site_id: "00000000-0000-4000-8000-000000000002" }]);
			const history = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
			expect(history.rows[0]?.count).toBe(12);
		} finally {
			await db.close();
		}
	}, 60_000);
});
