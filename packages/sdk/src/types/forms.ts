import type { z } from "zod";
import type {
	exportFormSubmissionsQuerySchema,
	formSubmissionStatusSchema,
	listFormSubmissionsQuerySchema,
} from "../schemas/forms.js";

export type FormSubmissionStatus = z.infer<typeof formSubmissionStatusSchema>;

/** One question and what the visitor answered. */
export type FormSubmissionField = {
	name: string;
	label: string;
	value: string;
};

/** What a visitor sent through a Form block. */
export type FormSubmission = {
	id: string;
	siteId: string;
	/** The page the form was on; null once that page is deleted. */
	pageId: string | null;
	formName: string;
	fields: FormSubmissionField[];
	status: FormSubmissionStatus;
	createdAt: string | null;
};

export type ListFormSubmissionsQuery = z.infer<typeof listFormSubmissionsQuerySchema>;
export type ExportFormSubmissionsQuery = z.infer<typeof exportFormSubmissionsQuerySchema>;

export type FormSubmissionList = {
	items: FormSubmission[];
	/** Submissions matching the filters, across all pages of the list. */
	total: number;
	/** Every form name the site has answers for, to build a filter. */
	formNames: string[];
	/** Unread answers on the whole site, whatever the filters. */
	unread: number;
	page: number;
	perPage: number;
	/** Page id to page title, for the pages the listed answers came from. */
	pageTitles: Record<string, string>;
};
