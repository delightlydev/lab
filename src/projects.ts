// One entry per project. The slug is the folder name under src/pages.
export interface Project {
  slug: string;
  title: string;
  description: string;
}

export const projects: Project[] = [
  {
    slug: "sample",
    title: "Sample",
    description: "A starting point: a canvas, the lab frame, and a share button.",
  },
  {
    slug: "voice-doodle",
    title: "Voice doodle",
    description: "A scribble that ripples and spins when it speaks.",
  },
];
