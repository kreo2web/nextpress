import { getBlockEntry, type BlockName } from "@shared/block-catalog";
import type { BlockCategory, BlockDefinition } from "./types";

type CatalogMeta = {
  id: string;
  label: string;
  description: string;
  category: BlockCategory;
  alsoIn?: BlockCategory[];
  defaultStyles: Record<string, string | number>;
  isContainer?: boolean;
  defaultChildren?: BlockDefinition["defaultChildren"];
};

/**
 * The parts of a block definition the shared catalog owns (name, label, defaults,
 * container flag, starting children). Spread it first into the editor definition so
 * the editor, the server and the SDK never disagree about what a block is.
 */
export const catalogMeta = (name: BlockName): CatalogMeta => {
  const entry = getBlockEntry(name);
  return {
    id: entry.name,
    label: entry.label,
    description: entry.description,
    category: entry.category,
    ...(entry.alsoIn ? { alsoIn: [...entry.alsoIn] } : {}),
    defaultStyles: { ...entry.defaultStyles },
    ...(entry.kind === "container" ? { isContainer: true } : {}),
    ...(entry.defaultChildren ? { defaultChildren: entry.defaultChildren } : {}),
  };
};
