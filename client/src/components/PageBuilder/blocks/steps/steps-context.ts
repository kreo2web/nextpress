import { createContext, useContext } from "react";
import type { StepsMarker } from "@shared/blocks/steps-model";

/**
 * A Step on the canvas is drawn by the shared child list, so Steps tells it which marker is in
 * use through context instead of props (the same way Tabs tells each Tab which tab is open). A
 * step outside Steps has no provider and keeps the number marker.
 */
export type StepsCanvasContext = { marker: StepsMarker };

export const StepsContext = createContext<StepsCanvasContext>({ marker: "number" });

export const useStepsContext = (): StepsCanvasContext => useContext(StepsContext);
