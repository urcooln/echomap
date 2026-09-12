import type { CareTeamRole } from "./auth-context";

export type DevelopmentDemoPersonaDefinition = {
  id: string;
  displayName: string;
  email: string;
};
export const DEVELOPMENT_DEMO_PERSONAS: Record<
  CareTeamRole,
  DevelopmentDemoPersonaDefinition
> = {
  Administrator: {
    id: "childled-development-demo-admin",
    displayName: "ChildLed Demo Administrator",
    email: "demo.admin@childled.local",
  },
  SLP: {
    id: "childled-development-demo-clinician",
    displayName: "Dr. Lena Ortiz",
    email: "demo.clinician@childled.local",
  },
  Parent: {
    id: "childled-development-demo-parent",
    displayName: "Maya Chen",
    email: "demo.parent@childled.local",
  },
  Teacher: {
    id: "childled-development-demo-teacher",
    displayName: "Jordan Blake",
    email: "demo.teacher@childled.local",
  },
};
