import type { Deps } from "../routes/shared/deps";

type DeleteSiteModels = Pick<
	Deps["models"],
	"sites" | "pages" | "blogs" | "media" | "options" | "roles" | "userRoles" | "formSubmissions"
>;

/** Whether the site was deleted, or the plain reason it was kept. */
export type SiteDeleteResult = { ok: true } | { ok: false; statusCode: 409; message: string };

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Deletes a site that holds no content. Pages, blogs and media are people's work, so a site that still
 * has any is kept, with a note on what to move or delete first. The rows that only mean something with
 * the site go with it: role assignments, site roles, options and form answers. Before this every delete
 * failed, because each new site has an admin role row pointing at it.
 */
export async function deleteEmptySite({
	models,
	siteId,
}: {
	models: DeleteSiteModels;
	siteId: string;
}): Promise<SiteDeleteResult> {
	const bySite = [{ where: "siteId", equals: siteId }];
	const [pageCount, blogCount, mediaCount] = await Promise.all([
		models.pages.count({ where: bySite }),
		models.blogs.count({ where: bySite }),
		models.media.count({ where: bySite }),
	]);

	const kept = [
		pageCount > 0 ? plural(pageCount, "page") : "",
		blogCount > 0 ? plural(blogCount, "blog") : "",
		mediaCount > 0 ? plural(mediaCount, "media file") : "",
	].filter(Boolean);
	if (kept.length > 0) {
		const onlyOne = pageCount + blogCount + mediaCount === 1;
		return {
			ok: false,
			statusCode: 409,
			message: `This site still has ${kept.join(", ")}. Delete or move ${onlyOne ? "it" : "them"} first, then delete the site.`,
		};
	}

	const assignments = await models.userRoles.findBySite(siteId);
	for (const assignment of assignments) await models.userRoles.delete(assignment.id);

	const siteRoles = await models.roles.findManyWhere(bySite);
	for (const role of siteRoles) {
		const roleAssignments = await models.userRoles.findManyWhere([{ where: "roleId", equals: role.id }]);
		for (const assignment of roleAssignments) await models.userRoles.delete(assignment.id);
		await models.roles.delete(role.id);
	}

	const siteOptions = await models.options.findManyWhere(bySite);
	for (const option of siteOptions) await models.options.delete(option.id);

	const submissions = await models.formSubmissions.findManyWhere(bySite);
	for (const submission of submissions) await models.formSubmissions.delete(submission.id);

	await models.sites.delete(siteId);
	return { ok: true };
}
