import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types";
import { isKnownBlockName } from "../known-block-names";
import { resolveRequiredApiKeyScopes } from "../api-key-scopes";
import { validateContentForSave } from "../validate-content-save";
import { buildTemplatePartBlock } from "./index";

describe("template part on save and in API scopes", () => {
	it("is a known block name, so pages holding a part can be saved", () => {
		expect(isKnownBlockName("core/template-part")).toBe(true);
	});

	it("passes save validation for a page that holds a part", () => {
		const shell: BlockConfig = {
			id: "shell",
			name: "core/page-shell",
			type: "container",
			parentId: null,
			content: { kind: "structured", data: {} },
			children: [{ ...buildTemplatePartBlock({ id: "part", templateId: "tpl-1" }), parentId: "shell" }],
		};
		const result = validateContentForSave({ blocks: [shell], other: {}, contentType: "page" });
		expect(result.ok).toBe(true);
	});

	it("gives the template list and usage routes the templates scope", () => {
		expect(resolveRequiredApiKeyScopes({ method: "GET", path: "/api/templates" })).toEqual(["templates:read"]);
		expect(
			resolveRequiredApiKeyScopes({ method: "GET", path: "/api/templates?usage=part&siteId=site-a" }),
		).toEqual(["templates:read"]);
		expect(resolveRequiredApiKeyScopes({ method: "GET", path: "/api/templates/tpl-1/usage" })).toEqual([
			"templates:read",
		]);
		expect(resolveRequiredApiKeyScopes({ method: "POST", path: "/api/templates" })).toEqual(["templates:write"]);
	});
});
