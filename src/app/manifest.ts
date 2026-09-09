import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Tree",
    short_name: "FamilyTree",
    description:
      "Private family trees, people, marriages, and relationship paths.",
    start_url: "/en",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#0d6e67",
    orientation: "any",
    lang: "en",
    dir: "auto",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
