"use client";

/**
 * The builder, rendered CLIENT-ONLY (#373).
 *
 * ⛔ WHY: server-rendering this component was burning a Vercel function for the
 * full 300-second ceiling — on GET *and* on the POST that follows a save, since
 * the save revalidates the path and Next re-renders it. Memory climbed
 * 218MB → 340MB while it ran. The page's own work finished fine; production
 * logging (v0.121.1) put the stall squarely after "handing off to render".
 *
 * ⭐ AND SSR BOUGHT NOTHING HERE. This is an interactive canvas: every pixel it
 * produces on the server is discarded the moment it hydrates. There is no SEO
 * to serve, no first paint worth having behind a login, and no content a
 * crawler wants — the markup existed only because a client component in the App
 * Router is server-rendered by default.
 *
 * ⚠️ This does NOT explain the loop, and does not pretend to: the same render
 * completes in ~2s locally in dev and in a production build over the same
 * document, parts library and rows. What it does is stop a render nobody reads
 * from being able to take a function down. If the loop is still in there it
 * will now show up in the browser, where it can be profiled — which is a
 * strictly better place for it than a serverless function that cannot say why
 * it died.
 */
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { SchematicEditor as SchematicEditorType } from "./editor";

const SchematicEditor = dynamic(
  () => import("./editor").then((m) => m.SchematicEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center text-sm text-gray-500">
        Loading the builder…
      </div>
    ),
  },
);

export function SchematicEditorClient(
  props: ComponentProps<typeof SchematicEditorType>,
) {
  return <SchematicEditor {...props} />;
}
