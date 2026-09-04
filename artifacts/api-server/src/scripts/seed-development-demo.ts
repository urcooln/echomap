import { seedDevelopmentDemo } from "../lib/development-demo";

const demo = await seedDevelopmentDemo();

console.log(
  `Seeded EchoMap development demo: organization=${demo.organizationId} child=${demo.childId}`,
);
