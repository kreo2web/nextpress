import type { HttpClient } from "../client/http-client.js";
import { parseInput } from "../client/validate-input.js";
import {
	exportFormSubmissionsQuerySchema,
	listFormSubmissionsQuerySchema,
	markFormSubmissionStatusSchema,
} from "../schemas/forms.js";
import { idParamSchema } from "../schemas/index.js";
import type {
	ExportFormSubmissionsQuery,
	FormSubmission,
	FormSubmissionList,
	FormSubmissionStatus,
	ListFormSubmissionsQuery,
} from "../types/forms.js";

const SUBMISSIONS_PATH = "/api/forms/submissions";

export type FormSubmissionsResource = {
	/**
	 * Read what visitors sent through Form blocks, newest first. Filter by `form` (the form's name)
	 * and `status`; the answer lists every form name and the unread count so you can build a filter.
	 */
	list: (params?: ListFormSubmissionsQuery) => Promise<FormSubmissionList>;
	/**
	 * All answers of the site (or one `form`) as CSV text, ready to save or hand to a spreadsheet.
	 * Not paged: use `list` for a slice.
	 */
	exportCsv: (params?: ExportFormSubmissionsQuery) => Promise<string>;
	/** Mark one answer `read` or `new` (back to unread) to track what has been dealt with. */
	markStatus: (params: { id: string; status: FormSubmissionStatus }) => Promise<FormSubmission>;
	/** Permanently remove one answer. */
	delete: (params: { id: string }) => Promise<void>;
};

export type FormsResource = {
	submissions: FormSubmissionsResource;
};

/** Form answers: what visitors sent through the site's Form blocks. */
export function createFormsResource({ http }: { http: HttpClient }): FormsResource {
	return {
		submissions: {
			list: async (params: ListFormSubmissionsQuery = {}): Promise<FormSubmissionList> => {
				const query = parseInput({
					schema: listFormSubmissionsQuerySchema,
					input: params,
					label: "forms.submissions.list params",
				});
				return http.request(SUBMISSIONS_PATH, { query });
			},

			exportCsv: async (params: ExportFormSubmissionsQuery = {}): Promise<string> => {
				const query = parseInput({
					schema: exportFormSubmissionsQuerySchema,
					input: params,
					label: "forms.submissions.exportCsv params",
				});
				return http.request(`${SUBMISSIONS_PATH}/export`, { query });
			},

			markStatus: async ({
				id,
				status,
			}: {
				id: string;
				status: FormSubmissionStatus;
			}): Promise<FormSubmission> => {
				const body = parseInput({
					schema: markFormSubmissionStatusSchema,
					input: { id, status },
					label: "forms.submissions.markStatus input",
				});
				return http.request(`${SUBMISSIONS_PATH}/${body.id}`, {
					method: "PATCH",
					body: { status: body.status },
				});
			},

			delete: async ({ id }: { id: string }): Promise<void> => {
				parseInput({
					schema: idParamSchema,
					input: { id },
					label: "forms.submissions.delete id",
				});
				return http.request(`${SUBMISSIONS_PATH}/${id}`, { method: "DELETE" });
			},
		},
	};
}
