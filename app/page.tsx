"use client";
import { useEffect, useRef } from "react";
export default function VistaDesktop() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let desktop: { dispose(): void } | undefined;
    let cancelled = false;
    import("../packages/shell/index.js")
      .then(async ({ createDesktop }) => {
        if (cancelled || !root.current) return;
        desktop = await createDesktop(root.current);
        if (cancelled) desktop?.dispose();
      })
      .catch((error) => {
        console.error(error);
        if (root.current)
          root.current.textContent = `The desktop could not start: ${error.message}. Please reload.`;
      });
    return () => {
      cancelled = true;
      desktop?.dispose();
    };
  }, []);
  return <main ref={root} id="vista-root" aria-label="Windows Vista desktop" />;
}
