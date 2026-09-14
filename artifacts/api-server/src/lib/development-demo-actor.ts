export const canAttachDevelopmentDemoActor = ({
  demoEnabled,
  hasChildledActor,
  clerkUserId,
  demoCookie,
}: {
  demoEnabled: boolean;
  hasChildledActor: boolean;
  clerkUserId?: string | null;
  demoCookie?: string | false;
}) =>
  demoEnabled &&
  !hasChildledActor &&
  !clerkUserId &&
  typeof demoCookie === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    demoCookie,
  );
