const SECTION_SCROLL_OFFSET = 18;

function getScrollBehavior(preferredBehavior: ScrollBehavior): ScrollBehavior {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "auto";
  }

  return preferredBehavior;
}

export function scrollToPageSection(
  targetId: string,
  preferredBehavior: ScrollBehavior = "smooth",
) {
  const behavior = getScrollBehavior(preferredBehavior);

  if (!targetId || targetId === "hero") {
    window.scrollTo({ top: 0, behavior });
    return true;
  }

  const target = document.getElementById(targetId);

  if (!target) {
    return false;
  }

  const navbar = document.getElementById("navbar");
  const navbarHeight = navbar?.getBoundingClientRect().height ?? 0;
  const top =
    target.getBoundingClientRect().top +
    window.scrollY -
    navbarHeight -
    SECTION_SCROLL_OFFSET;

  window.scrollTo({
    top: Math.max(0, top),
    behavior,
  });

  return true;
}
