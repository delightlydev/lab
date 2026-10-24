// One entry per project. The slug is the folder name under src/pages.
export interface Project {
  slug: string;
  title: string;
  description: string;
}

export const projects: Project[] = [
  {
    slug: "status-thread",
    title: "Status thread",
    description: "One thread that reshapes itself for every state: idle, listening, thinking, working, done, failed.",
  },
  {
    slug: "dot-orb",
    title: "Dot orb",
    description: "A ball of dots that reshapes itself for each state: sphere, swell, sweep, halftone, converge, ripple, check, tremor.",
  },
];
