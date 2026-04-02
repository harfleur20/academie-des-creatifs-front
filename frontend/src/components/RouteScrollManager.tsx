import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { scrollToPageSection } from "../utils/scroll";

export default function RouteScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const targetId = location.hash.replace("#", "");
    let frameId = 0;
    let retryTimeout = 0;

    const runScroll = () => {
      if (location.pathname === "/") {
        if (targetId) {
          const didScroll = scrollToPageSection(targetId, "smooth");

          if (!didScroll) {
            retryTimeout = window.setTimeout(() => {
              scrollToPageSection(targetId, "smooth");
            }, 140);
          }

          return;
        }

        scrollToPageSection("hero", "smooth");
        return;
      }

      window.scrollTo({ top: 0, behavior: "auto" });
    };

    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(runScroll);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(retryTimeout);
    };
  }, [location.hash, location.pathname]);

  return null;
}
