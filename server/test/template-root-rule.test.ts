import type { Request } from "express";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { testDb } from "./setup";
import {
	createPageModel,
	createRoleModel,
	createSiteModel,
	createTemplateModel,
	createUserModel,
	createUserRoleModel,
} from "../storage";
import type { Deps } from "../routes/shared/deps";
import { createTemplatesRoutes } from "../routes/templates.routes";
import { getZodSchema } from "../../shared/zod-schema";
import { TEMPLATE_ROOT_MESSAGE } from "@shared/template-parts";

vi.mock("../auth", () => ({
	attachRequestAuth: vi.fn(),
	getRequestAuthUserId: vi.fn(),
	resolveRequestAuth: vi.fn(),
	getRequestAuthSiteId: (req: { authSiteId?: string }) => req.authSiteId,
}));

const OWNER = "7b1f0000-0000-4000-8000-000000000001";
const SITE = "7b1f0000-0000-4000-8000-000000000011";

const container = (name: string, children: object[] = []) => ({
	id: crypto.randomUUID(),
	name,
	type: "container",
	parentId: null,
	content: { kind: "structured", data: {} },
	children,
});
const heading = () => ({ id: crypto.randomUUID(), name: "core/heading", type: "block", parentId: null, content: { kind: "text", value: "Hi", level: 2 } });
const shell = (children: object[]) => ({ ...container("core/page-shell", children) });

describe("a linked template is one layout or container block", () => {
	let server: Server;
	let base = "";
	const send = async (method: "POST" | "PUT", path: string, body: object) => {
		const response = await fetch(`${base}${path}`, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		return { status: response.status, body: (await response.json()) as { id?: string; message?: string; type?: string } };
	};

	beforeAll(async () => {
		await createUserModel(testDb).create({ id: OWNER, username: "tpl-owner", email: "tpl-owner@example.com" });
		await createSiteModel(testDb).create({ id: SITE, name: "Main", ownerId: OWNER, isDefault: true });

		const models = {
			templates: createTemplateModel(testDb),
			pages: createPageModel(testDb),
			sites: createSiteModel(testDb),
			roles: createRoleModel(testDb),
			userRoles: createUserRoleModel(testDb),
		} as unknown as Deps["models"];
		const deps = {
			models,
			requireAuth: (req: Request, _res: express.Response, next: express.NextFunction) => {
				Object.assign(req, { authUserId: OWNER });
				next();
			},
			authService: { getCurrentUserId: (req: Request) => (req as Request & { authUserId?: string }).authUserId ?? null },
			schemas: { templates: getZodSchema("templates") },
			hooks: { doAction: () => undefined },
		} as unknown as Deps;

		const app = express();
		app.use(express.json());
		app.use("/api/templates", createTemplatesRoutes(deps));
		server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	it("creates a template that is one layout block, whatever it holds, with no type of its own", async () => {
		const created = await send("POST", `/api/templates?siteId=${SITE}`, {
			name: "Price table",
			usage: "part",
			blocks: [container("core/columns", [heading(), heading()])],
		});
		expect(created.status).toBe(201);
		expect(created.body.type).toBe("part");
	});

	it("refuses to create a template from loose blocks, saying what a template is", async () => {
		const refused = await send("POST", `/api/templates?siteId=${SITE}`, { name: "Loose", usage: "part", blocks: [heading()] });
		expect(refused).toEqual({ status: 400, body: { message: TEMPLATE_ROOT_MESSAGE } });
	});

	it("refuses a save that leaves blocks beside the layout block, and accepts one with everything inside", async () => {
		const created = await send("POST", `/api/templates?siteId=${SITE}`, { name: "Sign-up", usage: "part", blocks: [container("core/group")] });
		const id = created.body.id ?? "";

		const beside = await send("PUT", `/api/templates/${id}`, { blocks: [shell([container("core/group"), heading()])] });
		expect(beside).toEqual({ status: 400, body: { message: TEMPLATE_ROOT_MESSAGE } });

		const inside = await send("PUT", `/api/templates/${id}`, { blocks: [shell([container("core/group", [heading()])])] });
		expect(inside.status).toBe(200);
	});
});
