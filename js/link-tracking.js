// Tracks clicks on calculator/article links inside content areas (guide body,
// related-links chips, CTA boxes, blog listing cards) so we can measure how
// often readers move between calculators and blog posts. Does not track
// header/footer navigation. No-ops silently if gtag isn't present.
(function () {
  function normalizeInternalPath(href) {
    if (!href) return null;
    try {
      var url = new URL(href, location.origin);
      var host = url.hostname.toLowerCase();
      var isLocalHost = url.origin === location.origin;
      var isProductionHost = host === "gofincalc.com" || host === "www.gofincalc.com";
      if (!isLocalHost && !isProductionHost) return null;
      return url.pathname || "/";
    } catch (e) {
      return null;
    }
  }

  function classify(path) {
    if (!path) return null;
    if (path.indexOf("/calculators/") === 0 || path.indexOf("/taxpilot/") === 0 ||
        path === "/finpilot" || path.indexOf("/finpilot/") === 0) return "calculator";
    if (path.indexOf("/blog/") === 0) return "article";
    return null;
  }

  function track(el) {
    try {
      if (typeof gtag !== "function") return;
      var targetPath = normalizeInternalPath(el.getAttribute("href") || "");
      var linkType = classify(targetPath);
      if (!linkType) return;
      gtag("event", linkType === "article" ? "related_article_click" : "related_calculator_click", {
        target_path: targetPath,
        source_path: location.pathname
      });
    } catch (e) {}
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a[href]");
    if (!el) return;
    if (el.closest(".cp-article, .calc-page-guide-body, .cp-related-links, .cp-cta, .cp-post-card, #blogPostGrid, .seo-guide")) {
      track(el);
    }
  }, true);
})();
