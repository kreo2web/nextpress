import { ReactNode, useState } from 'react';
import { Layout, Palette, Loader2, Plus } from 'lucide-react';
import { Link } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContentLists } from '@/hooks/useContentLists';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { appendSiteIdToUrl } from '@/lib/site-api';
import { useOptionalActiveSite } from '@/hooks/useActiveSite';
import { reIdTemplateBlocks } from '@/lib/re-id-template-blocks';
import type { BlockConfig } from '@shared/schema-types';

interface DesignMenuProps {
  children: ReactNode;
  currentPostId?: string;
  currentType?: 'post' | 'page' | 'template';
  onApplyTemplate?: (params: {
    templateId: string;
    blocks: BlockConfig[];
  }) => void;
}

/**
 * DesignMenu — apply real templates (blocks + FK) and activate themes.
 */
export function DesignMenu({
  children,
  currentPostId,
  currentType = 'page',
  onApplyTemplate,
}: DesignMenuProps) {
  const { templates, themes } = useContentLists();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApplying, setIsApplying] = useState(false);

  const contentEndpoint =
    currentType === 'post'
      ? `/api/posts/${currentPostId}`
      : `/api/pages/${currentPostId}`;

  const applyTemplateMutation = useMutation({
    mutationFn: async ({ templateId }: { templateId: string }) => {
      if (!currentPostId) {
        throw new Error('No post/page selected');
      }

      const templateResponse = await apiRequest('GET', `/api/templates/${templateId}`);
      const template = (await templateResponse.json()) as {
        id: string;
        name: string;
        blocks?: BlockConfig[];
      };

      const blocks = reIdTemplateBlocks(
        Array.isArray(template.blocks) ? template.blocks : [],
      );

      await apiRequest('PUT', contentEndpoint, { templateId, blocks });

      return { templateId, blocks, templateName: template.name };
    },
    onSuccess: (data) => {
      onApplyTemplate?.({
        templateId: data.templateId,
        blocks: data.blocks,
      });
      queryClient.invalidateQueries({ queryKey: [contentEndpoint] });
      toast({
        title: 'Template applied',
        description: `"${data.templateName}" layout is now on this ${currentType}.`,
      });
      setIsApplying(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply template',
        variant: 'destructive',
      });
      setIsApplying(false);
    },
  });

  // A theme belongs to one site: always say which one, or the server can't tell.
  const activeSites = useOptionalActiveSite();
  const siteId = activeSites?.activeSiteId ?? '';
  const siteLabel = activeSites?.activeSite ? activeSites.formatSiteLabel(activeSites.activeSite) : 'this site';

  const activateThemeMutation = useMutation({
    mutationFn: async ({ themeId }: { themeId: string }) => {
      return await apiRequest('POST', appendSiteIdToUrl(`/api/themes/${themeId}/activate`, siteId), {});
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/themes/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/site'] });
      queryClient.invalidateQueries({ queryKey: ['/api/public/site-theme'] });
      const theme = themes.find((t) => t.id === variables.themeId);
      toast({
        title: 'Theme activated',
        description: `${siteLabel} now uses "${theme?.name ?? 'this theme'}".`,
      });
      setIsApplying(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate theme',
        variant: 'destructive',
      });
      setIsApplying(false);
    },
  });

  const handleApplyTemplate = (templateId: string) => {
    if (!currentPostId) {
      toast({
        title: 'Error',
        description: 'Save this content first, then apply a template.',
        variant: 'destructive',
      });
      return;
    }
    setIsApplying(true);
    applyTemplateMutation.mutate({ templateId });
  };

  const handleApplyTheme = (themeId: string) => {
    setIsApplying(true);
    activateThemeMutation.mutate({ themeId });
  };

  if (currentType === 'template') {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Pre-designed blocks</DropdownMenuLabel>
        <DropdownMenuGroup>
          {templates.length > 0 ? (
            templates.slice(0, 5).map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleApplyTemplate(template.id)}
                disabled={isApplying || !currentPostId}>
                {isApplying && applyTemplateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Layout className="w-4 h-4" />
                )}
                {template.name}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/admin/pre-designed-blocks" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create a pre-designed block
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Themes</DropdownMenuLabel>
        <DropdownMenuGroup>
          {themes.length > 0 ? (
            themes.slice(0, 5).map((theme) => (
              <DropdownMenuItem
                key={theme.id}
                onClick={() => handleApplyTheme(theme.id)}
                disabled={isApplying}>
                {isApplying && activateThemeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Palette className="w-4 h-4" />
                )}
                {theme.name}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/admin/themes" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Manage themes
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
