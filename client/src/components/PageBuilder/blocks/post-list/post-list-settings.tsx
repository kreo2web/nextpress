import type { BlockConfig } from '@shared/schema-types';
import { SettingsDisclosure, SettingsLabel } from '../../shared';
import { SettingsChipGroup } from '../../settings-chip-group';
import { useSettingsState } from '../useSettingsState';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { LayoutList, Settings } from 'lucide-react';
import { type PostListContent, DEFAULT_CONTENT } from './post-list-model';

type PostListLayout = NonNullable<PostListContent['layout']>;
type PostListOpenIn = NonNullable<PostListContent['openIn']>;
type PostListOrderBy = NonNullable<PostListContent['orderBy']>;
type PostListOrder = NonNullable<PostListContent['order']>;

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'cards', label: 'Cards' },
];

const OPEN_IN_OPTIONS = [
  { value: 'overlay', label: 'In a layer' },
  { value: 'page', label: 'On its page' },
];

function isPostListLayout(value: string): value is PostListLayout {
  return value === 'grid' || value === 'list' || value === 'cards';
}

function isPostListOpenIn(value: string): value is PostListOpenIn {
  return value === 'overlay' || value === 'page';
}

function isPostListOrderBy(value: string): value is PostListOrderBy {
  return value === 'date' || value === 'title';
}

function isPostListOrder(value: string): value is PostListOrder {
  return value === 'asc' || value === 'desc';
}

export function PostListSettings({
  block,
  onUpdate,
}: {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
  const { content, updateContent } = useSettingsState<PostListContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  return (
    <div className="space-y-4">
      <CollapsibleCard title="Layout" icon={LayoutList} defaultOpen={true}>
        <div className="space-y-4">
          <SettingsChipGroup
            label="Layout"
            options={LAYOUT_OPTIONS}
            value={content.layout ?? 'grid'}
            onChange={(value) => {
              if (isPostListLayout(value)) {
                updateContent({ layout: value });
              }
            }}
          />
          <SettingsChipGroup
            label="Open posts"
            options={OPEN_IN_OPTIONS}
            value={content.openIn ?? 'overlay'}
            onChange={(value) => {
              if (isPostListOpenIn(value)) {
                updateContent({ openIn: value });
              }
            }}
          />
          <div>
            <SettingsLabel htmlFor="pl-count">Posts per page</SettingsLabel>
            <Input
              id="pl-count"
              type="number"
              min={1}
              max={50}
              className="h-9"
              value={content.postsPerPage ?? 6}
              onChange={(e) =>
                updateContent({
                  postsPerPage: Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Display" icon={Settings} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pl-excerpt">Show excerpt</SettingsLabel>
            <Switch
              id="pl-excerpt"
              checked={content.showExcerpt ?? true}
              onCheckedChange={(v) => updateContent({ showExcerpt: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pl-image">Show featured image</SettingsLabel>
            <Switch
              id="pl-image"
              checked={content.showFeaturedImage ?? true}
              onCheckedChange={(v) => updateContent({ showFeaturedImage: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pl-date">Show date</SettingsLabel>
            <Switch
              id="pl-date"
              checked={content.showDate ?? true}
              onCheckedChange={(v) => updateContent({ showDate: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pl-author">Show author</SettingsLabel>
            <Switch
              id="pl-author"
              checked={content.showAuthor ?? true}
              onCheckedChange={(v) => updateContent({ showAuthor: v })}
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Query" icon={Settings} defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <SettingsLabel htmlFor="pl-orderby">Order by</SettingsLabel>
            <Select
              value={content.orderBy ?? 'date'}
              onValueChange={(v) => {
                if (isPostListOrderBy(v)) {
                  updateContent({ orderBy: v });
                }
              }}>
              <SelectTrigger id="pl-orderby" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <SettingsLabel htmlFor="pl-order">Order</SettingsLabel>
            <Select
              value={content.order ?? 'desc'}
              onValueChange={(v) => {
                if (isPostListOrder(v)) {
                  updateContent({ order: v });
                }
              }}>
              <SelectTrigger id="pl-order" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest first</SelectItem>
                <SelectItem value="asc">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SettingsDisclosure
            title="Which blog"
            defaultOpen={Boolean(content.blogId)}>
            <div>
              <SettingsLabel htmlFor="pl-blog">Blog</SettingsLabel>
              <Input
                id="pl-blog"
                className="h-9"
                value={content.blogId ?? ''}
                onChange={(e) => updateContent({ blogId: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </SettingsDisclosure>
        </div>
      </CollapsibleCard>
    </div>
  );
}
