import type { SampleImage } from "../types/nix";

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: "sample-studio",
    title: "Architectural Design Studio",
    caption: "Natural daylight, concrete structure, and drafting table details",
    recommendedMode: "design",
    src: "/src/assets/images/sample_architectural_studio_1795347218403.jpg",
  },
  {
    id: "sample-chrono",
    title: "Chronograph & Field Notes",
    caption: "Handwritten notebook, dial markings, and optical lens engravings",
    recommendedMode: "ocr",
    src: "/src/assets/images/sample_vintage_chronograph_1795347218283.jpg",
  },
  {
    id: "sample-bakery",
    title: "Kyoto Bakery Counter",
    caption: "Painted wooden menu board, stacked ceramics, and street depth",
    recommendedMode: "overview",
    src: "/src/assets/images/sample_market_signage_1795347218184.jpg",
  },
];
