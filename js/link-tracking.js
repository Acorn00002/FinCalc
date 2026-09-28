// Tracks clicks on calculator/article links inside content areas (guide body,
// related-links chips, CTA boxes, blog listing cards) so we can measure how
// often readers move between calculators and blog posts. Does not track
// header/footer navigation. No-ops silently if gtag isn't present.
(function () {
  function classify(href) {
    if (!href) return null;
    if (href.indexOf("/calculators/") !== -1 || href.indexOf("/taxpilot/") !== -1 ||
        href.indexOf("/finpilot") !== -1 || href.indexOf("tab=") !== -1) return "calculator";
    if (href.indexOf("/blog/") !== -1) return "article";
    return null;
  }

  function track(el) {
    try {
      if (typeof gtag !== "function") return;
      var href = el.getAttribute("href") || "";
      var linkType = classify(href);
      if (!linkType) return;
      gtag("event", "related_content_click", {
        link_type: linkType,
        link_url: href,
        link_text: (el.textContent || "").trim().slice(0, 60),
        source_path: location.pathname
      });
    } catch (e) {}
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a[href]");
    if (!el) return;
    if (el.closest(".cp-article, .cp-related-links, .cp-cta, .cp-post-card, #blogPostGrid, .seo-guide")) {
      track(el);
    }
  }, true);
})();
