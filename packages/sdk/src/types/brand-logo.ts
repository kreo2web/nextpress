/** Input for `media.copyBrandLogo`. */
export type CopyBrandLogoInput = {
	/** A logo file on svgl.app, e.g. `https://svgl.app/library/github.svg`. */
	url: string;
	/** Becomes the logo's alt text. The server keeps the first 120 characters. */
	title?: string;
};
