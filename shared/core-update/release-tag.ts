import { NEXTPRESS_CONFIG } from "../../config";

const RELEASE_VERSION_PATTERN = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/;
const RELEASE_IMAGE_TAG_PATTERN = /^beta-v(\d{1,6}\.\d{1,6}\.\d{1,6})$/;

/** Install folder `nextpress` uses when none is given; the command shown to people omits it then. */
export const DEFAULT_INSTALL_DIR = "/opt/nextpress";

/** True for plain release versions (`1.4.3`). Anything else is never sent to the server runner. */
export const isReleaseVersion = (value: string): boolean => RELEASE_VERSION_PATTERN.test(value);

/**
 * Docker Hub tag of a release. deploy.sh publishes `beta-v<version>` (GitHub uses `v<version>`), and
 * `nextpress upgrade --version` takes the Docker tag. Same mapping as `release_image_tag` in scripts/nextpress.
 */
export const releaseImageTag = (version: string): string => `beta-v${version}`;

/** Release version behind an image tag (`beta-v1.4.1` → `1.4.1`); null for `latest` or unknown tags. */
export const versionFromImageTag = (tag: string): string | null =>
	RELEASE_IMAGE_TAG_PATTERN.exec(tag.trim())?.[1] ?? null;

/** Public release notes page for a version. */
export const releaseNotesUrl = (version: string): string =>
	`${NEXTPRESS_CONFIG.links.github}/releases/tag/v${version}`;

/**
 * The one command that updates this install by hand. `sudo` because the install folder belongs to root on
 * servers set up by the installer.
 */
export const buildManualUpdateCommand = ({
	version,
	installDir,
}: {
	version: string | null;
	installDir: string | null;
}): string => {
	const dirPart = installDir && installDir !== DEFAULT_INSTALL_DIR ? ` --install-dir ${installDir}` : "";
	const versionPart = version && isReleaseVersion(version) ? ` --version ${releaseImageTag(version)}` : "";
	return `sudo nextpress${dirPart} upgrade${versionPart}`;
};
