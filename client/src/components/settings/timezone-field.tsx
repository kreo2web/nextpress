import { useMemo, useState, type JSX } from 'react';
import { Check, ChevronsUpDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type TimezoneFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

/** Every timezone this browser knows, UTC first. */
const listTimezones = (): string[] => ['UTC', ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== 'UTC')];

const readableZone = (zone: string): string => zone.replace(/_/g, ' ').replace(/\//g, ' / ');

const timeIn = (zone: string): string =>
  new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit', weekday: 'short' }).format(new Date());

/** Picks the site's timezone from a searchable list and shows the time there now, so the choice is easy to check. */
export function TimezoneField({ value, onChange, error }: TimezoneFieldProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const zones = useMemo(listTimezones, []);

  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">Timezone</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="timezone"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            className="w-full max-w-md justify-between font-normal"
          >
            <span className="truncate">{readableZone(value)}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search a city or region…" />
            <CommandList className="max-h-72">
              <CommandEmpty>No timezone matches.</CommandEmpty>
              {zones.map((zone) => (
                <CommandItem
                  key={zone}
                  value={readableZone(zone)}
                  onSelect={() => {
                    onChange(zone);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${zone === value ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
                  {readableZone(zone)}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="flex items-center gap-1.5 text-sm text-npb-text-muted">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        It's {timeIn(value)} there now. Post dates on your site use this timezone.
      </p>
      {error ? <p className="text-sm text-npb-status-error">{error}</p> : null}
    </div>
  );
}
