import { isCoreUpdateRunActive, type CoreUpdateManageStatus } from '@shared/core-update';

/** What a notice (sidebar or dashboard) says about updates, or null when there is nothing to say. */
export type CoreUpdateNotice = {
  tone: 'available' | 'running' | 'problem';
  /** Short line for the sidebar. */
  label: string;
  /** Second sidebar line. */
  hint: string;
  /** Dashboard card heading and line. */
  headline: string;
  detail: string;
  /** The one button. */
  action: string;
};

/** One rule for both notices, so the sidebar and the dashboard never disagree about what to show. */
export function describeUpdateNotice(status: CoreUpdateManageStatus): CoreUpdateNotice | null {
  const { run, latestVersion, installedVersion, updateAvailable } = status;

  if (isCoreUpdateRunActive(run)) {
    return {
      tone: 'running',
      label: 'Updating NextPress…',
      hint: `To v${run?.version}`,
      headline: `NextPress is updating to ${run?.version}`,
      detail: 'Your sites may be offline for a moment.',
      action: 'View progress',
    };
  }

  if (!updateAvailable || !latestVersion) return null;

  if (run?.state === 'failed' && run.version === latestVersion) {
    return {
      tone: 'problem',
      label: "Update didn't finish",
      hint: `Still on v${installedVersion}`,
      headline: "The last update didn't finish",
      detail: `Your sites are running NextPress ${installedVersion}.`,
      action: 'See what happened',
    };
  }

  return {
    tone: 'available',
    label: `Update available · v${latestVersion}`,
    hint: `Installed v${installedVersion}`,
    headline: `NextPress ${latestVersion} is available`,
    detail: `You're on ${installedVersion}. Updating takes your sites offline for ${status.downtime}.`,
    action: 'Update now',
  };
}
