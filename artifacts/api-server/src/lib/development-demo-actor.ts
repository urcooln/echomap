export const canAttachDevelopmentDemoActor = ({
  demoEnabled,
  hasChildledActor,
  clerkUserId,
  demoCookie,
}: {
  demoEnabled: boolean;
  hasChildledActor: boolean;
  clerkUserId?: string | null;
  demoCookie?: string;
}) =>
  demoEnabled &&
  !hasChildledActor &&
  !clerkUserId &&
  demoCookie === "active";
