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
];
