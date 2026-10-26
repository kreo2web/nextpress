import { useMemo, useState } from 'react';
import {
  buildBlockLibraryCategories,
  type BlockLibraryCategory,
} from './BlockLibrary';

/** Library accordion data and actions shared by builder shells. */
export type BuilderLibraryState = {
  categories: BlockLibraryCategory[];
  openCategories: Record<string, boolean>;
  allLibraryGroupsExpanded: boolean;
  onToggleLibraryFold: () => void;
  onCategoryOpenChange: (categoryId: string, open: boolean) => void;
};

/**
 * Keeps library accordion state outside panel markup so compact and split
 * shells use identical fold-all behavior. `build` makes the groups once; the
 * docs editor passes its own (the docs sections), the page builder the default.
 */
export function useBuilderLibraryState({
  build = buildBlockLibraryCategories,
}: { build?: () => BlockLibraryCategory[] } = {}): BuilderLibraryState {
  const categories = useMemo(() => build(), [build]);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    () =>
      categories.reduce<Record<string, boolean>>(
        (accumulator, category) => ({
          ...accumulator,
          [category.id]: true,
        }),
        {},
      ),
  );

  const allLibraryGroupsExpanded = useMemo(() => {
    if (categories.length === 0) return true;
    return categories.every((category) => openCategories[category.id] !== false);
  }, [categories, openCategories]);

  const onToggleLibraryFold = () => {
    if (categories.length === 0) return;
    const nextOpen = !allLibraryGroupsExpanded;
    setOpenCategories(
      Object.fromEntries(
        categories.map((category) => [category.id, nextOpen]),
      ),
    );
  };

  const onCategoryOpenChange = (categoryId: string, open: boolean) => {
    setOpenCategories((previous) => ({
      ...previous,
      [categoryId]: open,
    }));
  };

  return {
    categories,
    openCategories,
    allLibraryGroupsExpanded,
    onToggleLibraryFold,
    onCategoryOpenChange,
  };
}
