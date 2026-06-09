/** Returns the canonical catalog URL based on whether the landing page is enabled.
 *  When the landing page is on, `/` renders the marketing page and `/shop` is the catalog.
 *  When off, `/` IS the catalog. */
export function catalogHref(landingEnabled?: boolean): string {
  return landingEnabled ? '/shop' : '/'
}
