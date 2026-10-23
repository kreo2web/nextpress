import { CircleCheck, CircleSlash, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AiSettingsReadonlyProps = {
  isEnabled: boolean;
};

/** What people who can edit the site but not manage it see: whether the assistant is on, and who can change that. */
export function AiSettingsReadonly({ isEnabled }: AiSettingsReadonlyProps) {
  return (
    <Card className="admin-surface">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="mr-2 h-5 w-5 text-npb-accent" aria-hidden />
          Page assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-npb-text-primary">
          {isEnabled ? (
            <CircleCheck className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
          ) : (
            <CircleSlash className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
          )}
          {isEnabled ? 'The page assistant is on for this site.' : 'The page assistant is off for this site.'}
        </p>
        <p className="text-sm text-npb-text-secondary">
          Only this site's owner or admins can change which AI service it uses.
        </p>
      </CardContent>
    </Card>
  );
}
