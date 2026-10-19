import { useSettingsState } from '../useSettingsState';
import type { BlockConfig } from '@shared/schema-types';
import { SettingsLabel, SettingsSection } from '../../shared';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { type PostCommentsContent } from './post-comments-model';
import { POST_COMMENTS_DEFAULT_CONTENT as DEFAULT_CONTENT } from '@shared/block-catalog/post-blocks';

/** Sidebar settings panel for the post comments block. */
export function PostCommentsSettings({
  block,
  onUpdate,
}: {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
  const { content, updateContent } = useSettingsState<PostCommentsContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  return (
    <div className="space-y-4">
      <SettingsSection>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pc-show-form">Show comment form</SettingsLabel>
            <Switch
              id="pc-show-form"
              checked={content.showForm ?? true}
              onCheckedChange={(v) => updateContent({ showForm: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pc-show-count">Show comment count</SettingsLabel>
            <Switch
              id="pc-show-count"
              checked={content.showCount ?? true}
              onCheckedChange={(v) => updateContent({ showCount: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="pc-allow-replies">Allow replies</SettingsLabel>
            <Switch
              id="pc-allow-replies"
              checked={content.allowReplies ?? true}
              onCheckedChange={(v) => updateContent({ allowReplies: v })}
            />
          </div>
          <div>
            <SettingsLabel htmlFor="pc-per-page">Comments per page</SettingsLabel>
            <Input
              id="pc-per-page"
              type="number"
              min={1}
              max={100}
              className="h-9"
              value={content.commentsPerPage ?? 10}
              onChange={(e) =>
                updateContent({
                  commentsPerPage: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
