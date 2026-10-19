import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder shaped like the form: title, a row of choices, three fields, then the buttons. */
export function AiSettingsSkeleton() {
  return (
    <Card className="admin-surface" role="status" aria-busy="true" aria-label="Loading the AI settings">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-56 max-w-full" />
          </div>
        </div>
        {[0, 1].map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full md:h-9" />
          </div>
        ))}
        <div className="space-y-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-11 w-full md:h-9" />
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Skeleton className="h-11 w-28 md:h-9" />
      </CardFooter>
    </Card>
  );
}
