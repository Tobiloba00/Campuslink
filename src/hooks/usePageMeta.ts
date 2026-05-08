import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  /** When set, overrides the canonical link tag for this route */
  canonical?: string;
}

const SITE_NAME = "CampusLink";

/**
 * Updates document.title, meta[name=description], canonical link, and the
 * og: / twitter: variants on mount. Reverts to the original index.html
 * defaults on unmount so a single SPA navigation doesn't poison the next.
 *
 * SPA SEO note: Google and most modern crawlers DO render JavaScript and
 * pick up these dynamic tags. For non-JS social previews (WhatsApp link
 * unfurls etc.), the tags in index.html are still the source of truth.
 */
export const usePageMeta = ({ title, description, canonical }: PageMeta) => {
  useEffect(() => {
    const fullTitle = `${title} · ${SITE_NAME}`;
    const prevTitle = document.title;
    document.title = fullTitle;

    const setMeta = (selector: string, attr: "content" | "href", value: string) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      const prev = el?.getAttribute(attr) ?? null;
      if (el && value) el.setAttribute(attr, value);
      return { el, prev };
    };

    const restorations: Array<() => void> = [];
    const remember = (r: { el: HTMLElement | null; prev: string | null }, attr: string) => {
      if (r.el) restorations.push(() => {
        if (r.prev != null) r.el!.setAttribute(attr, r.prev);
      });
    };

    if (description) {
      remember(setMeta('meta[name="description"]', "content", description), "content");
      remember(setMeta('meta[property="og:description"]', "content", description), "content");
      remember(setMeta('meta[name="twitter:description"]', "content", description), "content");
    }

    remember(setMeta('meta[property="og:title"]', "content", fullTitle), "content");
    remember(setMeta('meta[name="twitter:title"]', "content", fullTitle), "content");

    if (canonical) {
      const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
      const prevCanonical = canonicalEl?.href ?? null;
      const prevOgUrl = ogUrl?.content ?? null;
      if (canonicalEl) canonicalEl.href = canonical;
      if (ogUrl) ogUrl.content = canonical;
      restorations.push(() => {
        if (canonicalEl && prevCanonical != null) canonicalEl.href = prevCanonical;
        if (ogUrl && prevOgUrl != null) ogUrl.content = prevOgUrl;
      });
    }

    return () => {
      document.title = prevTitle;
      restorations.forEach((fn) => fn());
    };
  }, [title, description, canonical]);
};
