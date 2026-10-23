/**
 * Logo cloud styles, shared by the editor canvas and published pages (same classes, same markup).
 * The marquee moves with `transform` only. Each of the two lists carries its own trailing gap, so
 * sliding the track by exactly half its width loops with no visible jump.
 */
export const LOGO_CLOUD_CSS = `
.wp-block-logo-cloud {
  --np-logo-gap: 2.5rem;
  width: 100%;
}
.wp-block-logo-cloud .np-logos__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1.5rem var(--np-logo-gap);
}
.wp-block-logo-cloud .np-logos__item {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wp-block-logo-cloud .np-logos__item a {
  display: inline-flex;
  border-radius: 4px;
}
.wp-block-logo-cloud .np-logos__item img {
  display: block;
  height: var(--np-logo-h, 40px);
  width: auto;
  max-width: 100%;
  object-fit: contain;
}
.wp-block-logo-cloud.np-logos--grid .np-logos__list {
  display: grid;
  grid-template-columns: repeat(var(--np-logo-cols, 5), minmax(0, 1fr));
  justify-items: center;
}
.wp-block-logo-cloud.is-grayscale .np-logos__item img {
  filter: grayscale(1);
  opacity: 0.7;
}
.wp-block-logo-cloud.is-grayscale .np-logos__item:hover img,
.wp-block-logo-cloud.is-grayscale .np-logos__item:focus-within img {
  filter: none;
  opacity: 1;
}

/* Marquee: a clipped window with a soft fade at both ends, and a track holding two copies. */
.wp-block-logo-cloud.is-marquee {
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
}
.wp-block-logo-cloud.is-marquee .np-logos__track {
  display: flex;
  width: max-content;
  animation: np-logos-scroll 30s linear infinite;
  will-change: transform;
}
.wp-block-logo-cloud.is-marquee .np-logos__list {
  flex-wrap: nowrap;
  flex-shrink: 0;
  justify-content: flex-start;
  padding-right: var(--np-logo-gap);
}
.wp-block-logo-cloud.is-marquee .np-logos__item {
  flex-shrink: 0;
}
.wp-block-logo-cloud.is-marquee:hover .np-logos__track,
.wp-block-logo-cloud.is-marquee:focus-within .np-logos__track {
  animation-play-state: paused;
}
@keyframes np-logos-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* Less motion: nothing moves, the first list wraps and the copy is hidden. */
@media (prefers-reduced-motion: reduce) {
  .wp-block-logo-cloud.is-marquee {
    -webkit-mask-image: none;
    mask-image: none;
    overflow: visible;
  }
  .wp-block-logo-cloud.is-marquee .np-logos__track {
    animation: none;
    width: auto;
    will-change: auto;
  }
  .wp-block-logo-cloud.is-marquee .np-logos__list {
    flex-wrap: wrap;
    justify-content: center;
    padding-right: 0;
  }
  .wp-block-logo-cloud.is-marquee .np-logos__list[aria-hidden="true"] {
    display: none;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .wp-block-logo-cloud.np-logos--grid .np-logos__list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .wp-block-logo-cloud { --np-logo-gap: 1.75rem; }
  .wp-block-logo-cloud.np-logos--grid .np-logos__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container npb-canvas (min-width: 768px) and (max-width: 1023px) {
  .npb-canvas-page .wp-block-logo-cloud.np-logos--grid .np-logos__list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container npb-canvas (max-width: 767px) {
  .npb-canvas-page .wp-block-logo-cloud { --np-logo-gap: 1.75rem; }
  .npb-canvas-page .wp-block-logo-cloud.np-logos--grid .np-logos__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
