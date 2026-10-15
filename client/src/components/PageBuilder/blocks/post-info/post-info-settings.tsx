import type { BlockConfig } from '@shared/schema-types';
import { SettingsDisclosure, SettingsLabel, SettingsSection } from '../../shared';
import { SettingsChipGroup } from '../../settings-chip-group';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsState } from '../useSettingsState';
import { defaultParseContent, defaultSerializeContent } from '../createBlockDefinition';
import { usePostDocument } from '../../PageContext';
import {
  type PostInfoContent,
  DEFAULT_CONTENT,
  DATE_FORMAT_OPTIONS,
  LAYOUT_OPTIONS,
} from './post-info-model';

interface PostInfoSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

function isDateFormat(
  value: string,
): value is NonNullable<PostInfoContent['dateFormat']> {
  return value === 'short' || value === 'long' || value === 'relative';
}

function isLayout(value: string): value is NonNullable<PostInfoContent['layout']> {
  return value === 'inline' || value === 'stacked';
}

/** Sidebar settings panel for the post info block. */
export function PostInfoSettings({ block, onUpdate }: PostInfoSettingsProps) {
  const { content, updateContent } = useSettingsState<PostInfoContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
    parseContent: defaultParseContent,
    serializeContent: defaultSerializeContent,
  });
  const postDocument = usePostDocument();

  const toggles = [
    {
      id: 'show-date',
      label: 'Show Date',
      key: 'showDate' as const,
      value: content?.showDate ?? true,
    },
    {
      id: 'show-categories',
      label: 'Show Categories',
      key: 'showCategories' as const,
      value: content?.showCategories ?? true,
    },
    {
      id: 'show-tags',
      label: 'Show Tags',
      key: 'showTags' as const,
      value: content?.showTags ?? true,
    },
    {
      id: 'show-readtime',
      label: 'Show Read Time',
      key: 'showReadTime' as const,
      value: content?.showReadTime ?? true,
    },
  ];

  return (
    <SettingsSection>
      {toggles.map((toggle) => (
        <div key={toggle.id} className="flex items-center justify-between">
          <SettingsLabel htmlFor={toggle.id}>{toggle.label}</SettingsLabel>
          <Switch
            id={toggle.id}
            checked={toggle.value}
            onCheckedChange={(checked) =>
              updateContent({ [toggle.key]: checked })
            }
          />
        </div>
      ))}

      <SettingsDisclosure title="Format">
        <div>
          <SettingsLabel>Date Format</SettingsLabel>
          <Select
            value={content?.dateFormat ?? 'long'}
            onValueChange={(val) => {
              if (!isDateFormat(val)) return;
              updateContent({ dateFormat: val });
            }}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SettingsChipGroup
          label="Layout"
          options={[...LAYOUT_OPTIONS]}
          value={content?.layout ?? 'inline'}
          onChange={(value) => {
            if (!isLayout(value)) return;
            updateContent({ layout: value });
          }}
        />
      </SettingsDisclosure>

      <SettingsDisclosure title="Details">
        <div>
          <SettingsLabel htmlFor="post-info-categories">Categories</SettingsLabel>
          <Input
            id="post-info-categories"
            value={(postDocument?.categories ?? []).join(', ')}
            onChange={(e) =>
              postDocument?.updateDocument({
                categories: e.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="News, Guides"
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div>
          <SettingsLabel htmlFor="post-info-tags">Tags</SettingsLabel>
          <Input
            id="post-info-tags"
            value={(postDocument?.tags ?? []).join(', ')}
            onChange={(e) =>
              postDocument?.updateDocument({
                tags: e.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="writing, design"
            className="mt-1 h-9 text-sm"
          />
        </div>
      </SettingsDisclosure>
    </SettingsSection>
  );
}
