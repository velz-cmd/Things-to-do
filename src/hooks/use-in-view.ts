"use client";

import { useEffect, useState, type RefObject } from "react";

/** True once `ref` intersects the viewport (or a margin). */
export function useInView(
  ref: RefObject<Element | null>,
  rootMargin = "200px"
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, inView, rootMargin]);

  return inView;
}
