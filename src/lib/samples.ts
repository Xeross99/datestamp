// The photos of the "how it looks" examples (public/samples/<key>.webp,
// 800×600), one per example, by Kamil Krzysteczko on Unsplash, under the
// Unsplash License (free, commercial use allowed, credit not required but
// given under the examples). Each is lazy-loaded.

export const SAMPLES_AUTHOR = { name: "Kamil Krzysteczko", url: "https://unsplash.com/@kamil141998" }

export const samples = [
  { key: "mountain", photoUrl: "https://unsplash.com/photos/MVuYz7gGSrw" },
  { key: "grass", photoUrl: "https://unsplash.com/photos/2Grsl_qwGM0" },
  { key: "forest", photoUrl: "https://unsplash.com/photos/VbdG7DG2ydk" },
] as const

export type SampleKey = (typeof samples)[number]["key"]
