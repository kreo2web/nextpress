import { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useLocation } from "wouter";
import {
  showSuccessToast,
  resolveCreatePageError,
} from "@/lib/sonner-toast";
import { apiRequest } from "@/lib/queryClient";
import { useActiveSite } from "@/hooks/useActiveSite";
import { mergePageOtherWithDefaults } from "@shared/page-other";
import { reIdTemplateBlocks } from "@/lib/re-id-template-blocks";
import { useContentLists } from "@/hooks/useContentLists";
import { FilePlus, Loader2, PenLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAiStatus } from "@/hooks/use-ai-settings";
import { setPendingDescription } from "@/components/PageBuilder/assistant/assistant-storage";
import type { Page, BlockConfig } from "@shared/schema-types";

interface CreatePageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle?: string;
}

/**
 * What the new page asks for. The address comes from the title; the featured image, comments,
 * password, parent page and menu order are set in Page settings in the editor.
 */
interface PageFormData {
  title: string;
  templateId?: string;
  /** "Describe your page": handed to the editor, whose assistant builds a first draft on open. */
  description?: string;
}

type FormError = { field: "title" | "form"; message: string };

type ApiFailure = Error & { status?: number; code?: string };

/**
 * Generates a URL-friendly slug from the title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * With no address field any more, a title that matches an existing page's address can only be
 * fixed by changing the title, so that is what the message says.
 */
function readCreateError(error: Error): FormError {
  const failure = error as ApiFailure;
  if (failure.status === 409 || failure.code === "PAGE_SLUG_EXISTS") {
    return { field: "title", message: "A page with this title already exists. Try a slightly different title." };
  }
  return { field: "form", message: resolveCreatePageError(error) };
}

/**
 * The step after "Page" in the New chooser: a title, an optional description for the assistant,
 * and what to start from. Everything else about a page (address, featured image, comments,
 * password, parent, menu order) is set in Page settings in the editor.
 */
export function CreatePageModal({
  open,
  onOpenChange,
  initialTitle = "",
}: CreatePageModalProps) {
  const [formData, setFormData] = useState<PageFormData>({ title: initialTitle });
  const [error, setError] = useState<FormError | null>(null);

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { activeSiteId } = useActiveSite();
  const { templates } = useContentLists();
  const assistantEnabled = useAiStatus({ siteId: activeSiteId }).data?.enabled === true;
  const address = generateSlug(formData.title);

  // Update title when initialTitle changes
  useEffect(() => {
    if (initialTitle && !formData.title) {
      setFormData((prev) => ({ ...prev, title: initialTitle }));
    }
  }, [initialTitle, formData.title]);

  /**
   * Updates one form field. A new title clears a title complaint, since it may now be fine.
   */
  const handleFieldChange = (field: keyof PageFormData, value: string | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "title") setError((current) => (current?.field === "title" ? null : current));
  };

  /**
   * Mutation for creating a new page
   */
  const createMutation = useMutation({
    mutationFn: async (data: PageFormData) => {
      const selectedTemplate = data.templateId
        ? templates.find((template) => template.id === data.templateId)
        : undefined;
      const starterBlocks = selectedTemplate?.blocks
        ? reIdTemplateBlocks(selectedTemplate.blocks as BlockConfig[])
        : [];

      const payload = {
        title: data.title || "Untitled",
        slug: generateSlug(data.title) || `untitled-${Date.now()}`,
        status: "draft", // Always draft on creation
        siteId: activeSiteId,
        blocks: starterBlocks,
        other: mergePageOtherWithDefaults(),
        allowComments: true,
        menuOrder: 0,
        templateId: data.templateId || undefined,
      };

      const response = await apiRequest("POST", "/api/pages", payload);
      return await response.json();
    },
    onSuccess: (newPage: Page, variables: PageFormData) => {
      showSuccessToast("Page created successfully");
      const description = variables.description?.trim();
      if (description && assistantEnabled) {
        setPendingDescription({ pageId: String(newPage.id), description });
      }

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });

      // Navigate to the new page in editor
      setLocation(`/admin/page-builder/page/${newPage.id}?mode=builder`);

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
    },
    onError: (failure: Error) => {
      console.error({
        atFunction: "CreatePageModal.createPage",
        data: { siteId: activeSiteId, title: formData.title, templateId: formData.templateId, error: failure },
        message: "Creating a page failed",
      });
      setError(readCreateError(failure));
    },
  });

  /**
   * Handles form submission with validation
   */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (createMutation.isPending) return;
    if (!formData.title.trim()) {
      setError({ field: "title", message: "Give the page a title." });
      return;
    }
    setError(null);
    createMutation.mutate(formData);
  };

  /**
   * Resets form to initial state
   */
  const resetForm = () => {
    setFormData({ title: "" });
    setError(null);
  };

  /**
   * Handles dialog close with form reset
   */
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 p-0"
        showCloseButton={!createMutation.isPending}
      >
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
          aria-busy={createMutation.isPending || undefined}
        >
          <DialogHeader className="flex-row items-center gap-3 border-b border-npb-divider px-5 py-4 text-left">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary"
            >
              <FilePlus className="size-4" />
            </span>
            <DialogTitle className="text-base">New page</DialogTitle>
            <DialogDescription className="sr-only">
              Give the page a title. You design it in the page builder right after.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor="new-page-title">Title</Label>
              <Input
                id="new-page-title"
                placeholder="About us"
                autoComplete="off"
                value={formData.title}
                disabled={createMutation.isPending}
                aria-invalid={error?.field === "title" ? true : undefined}
                aria-describedby={error?.field === "title" ? "new-page-title-error" : "new-page-title-hint"}
                onChange={(e) => handleFieldChange("title", e.target.value)}
                autoFocus
              />
              {error?.field === "title" ? (
                <p id="new-page-title-error" role="alert" className="text-sm text-npb-status-error">
                  {error.message}
                </p>
              ) : (
                <p id="new-page-title-hint" className="text-xs text-npb-text-muted">
                  {address ? `Its address will be /${address}. ` : "Its address comes from the title. "}
                  You can change it later in Page settings.
                </p>
              )}
            </div>

            {assistantEnabled ? (
              <div className="grid gap-2">
                <Label htmlFor="description" className="flex items-center gap-1.5">
                  <PenLine className="h-4 w-4 text-npb-text-muted" aria-hidden />
                  Describe your page (optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="A landing page for a yoga studio: a hero with a booking button, class times, prices and a contact form"
                  value={formData.description ?? ""}
                  disabled={createMutation.isPending}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-npb-text-muted">
                  The assistant builds a first draft when the editor opens. Nothing is published.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2 [&_[data-slot=native-select-wrapper]]:w-full">
              <Label htmlFor="new-page-start">Start from</Label>
              {templates.length > 0 ? (
                <NativeSelect
                  id="new-page-start"
                  value={formData.templateId ?? ""}
                  disabled={createMutation.isPending}
                  onChange={(e) => handleFieldChange("templateId", e.target.value || undefined)}
                >
                  <NativeSelectOption value="">Blank</NativeSelectOption>
                  {templates.map((template) => (
                    <NativeSelectOption key={template.id} value={template.id}>
                      {template.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                <p className="text-sm text-npb-text-muted">
                  No templates yet. The page will start blank.
                </p>
              )}
            </div>

            {error?.field === "form" ? (
              <p role="alert" className="text-sm text-npb-status-error">
                {error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-npb-divider bg-npb-surface-raised px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {createMutation.isPending ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
