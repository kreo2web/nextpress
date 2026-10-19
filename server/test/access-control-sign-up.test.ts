import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSignUpGate, giveVisitorRole } from "../lib/accounts/visitor-sign-up";
import { listWorkableSites, readSiteAccess } from "../lib/access";
import { ID, models, seedAccessFixture } from "./fixtures/access-fixture";

let server: Server;
let port: number;

beforeAll(async () => {
	const app = express();
	app.use("/api/auth/sign-up", createSignUpGate({ models }));
	// Stands in for Better Auth: reaching it means the gate let the sign-up through.
	app.post("/api/auth/sign-up/email", (_req, res) => res.status(200).json({ reached: true }));
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
	await seedAccessFixture();
});

/** A web sign-up sent to a site's address (the Host header picks the site; fetch won't let a test set it). */
const signUpOn = (host: string): Promise<{ status: number; body: Record<string, unknown> }> =>
	new Promise((resolve, reject) => {
		const payload = JSON.stringify({ email: "new@test.local", password: "long-enough-1", name: "New" });
		const req = request(
			{ port, method: "POST", path: "/api/auth/sign-up/email", headers: { "Content-Type": "application/json", Host: host, "Content-Length": Buffer.byteLength(payload) } },
			(res) => {
				let text = "";
				res.on("data", (chunk) => (text += chunk));
				res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) as Record<string, unknown> }));
			},
		);
		req.on("error", reject);
		req.end(payload);
	});

describe("visitor sign-up", () => {
	it("is closed unless the site turns it on, with a message that points to an invite", async () => {
		const refused = await signUpOn("site-a.localhost");
		expect(refused.status).toBe(403);
		expect(refused.body).toMatchObject({ code: "SIGN_UP_CLOSED" });
		expect(String(refused.body.message)).toMatch(/invite/i);
	});

	it("each site decides for itself: turning it on for site B leaves site A closed", async () => {
		await models.sites.updateSettings({ discussion: { enableRegistration: true } }, ID.siteB);
		expect((await signUpOn("site-b.localhost")).body).toEqual({ reached: true });
		expect((await signUpOn("site-a.localhost")).status).toBe(403);
	});

	it("a visitor account becomes a subscriber on the site it signed up on, with no dashboard", async () => {
		await models.sites.updateSettings({ discussion: { enableRegistration: true } }, ID.siteB);
		await giveVisitorRole({ models, userId: ID.stranger, host: "site-b.localhost" });

		expect((await readSiteAccess({ models, userId: ID.stranger, siteId: ID.siteB })).standing).toBe("subscriber");
		expect((await readSiteAccess({ models, userId: ID.stranger, siteId: ID.siteA })).standing).toBeNull();
		expect(await listWorkableSites({ models, userId: ID.stranger })).toEqual([]);
	});

	it("gives no role when the site doesn't take visitor accounts", async () => {
		await giveVisitorRole({ models, userId: ID.stranger, host: "site-a.localhost" });
		expect((await readSiteAccess({ models, userId: ID.stranger, siteId: ID.siteA })).standing).toBeNull();
	});
});
