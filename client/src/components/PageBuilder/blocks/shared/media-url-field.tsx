import React, { useState } from "react";
import type { JSX } from "react";
import type { Media } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { SettingsLabel } from "../../shared";
import { MediaThumb, type MediaThumbKind } from "./media-thumb";

type MediaKind = MediaThumbKind;

type MediaUrlFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: ({ url }: { url: string }) => void;
  onLibrarySelect: ({ item }: { item: Media }) => void;
  kind: MediaKind;
  placeholder?: string;
  libraryButtonLabel?: string;
};

/**
 * Picture (or clip) plus an address and a library picker — shared by image, video,
 * audio, gallery, cover, header, and media-text settings.
 */
export function MediaUrlField({
  id,
  label,
  value,
  onChange,
  onLibrarySelect,
  kind,
  placeholder,
  libraryButtonLabel = "Choose from library",
}: MediaUrlFieldProps): JSX.Element {
  const [isPickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <SettingsLabel htmlFor={id}>{label}</SettingsLabel>
      <MediaThumb url={value} kind={kind} />
      <div className="mt-1 space-y-2">
        <Input
          id={id}
          className="w-full"
          value={value}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          onClick={() => setPickerOpen(true)}>
          {libraryButtonLabel}
        </Button>
      </div>
      <MediaPickerDialog
        open={isPickerOpen}
        onOpenChange={setPickerOpen}
        kind={kind}
        onSelect={(item) => {
          onLibrarySelect({ item });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
