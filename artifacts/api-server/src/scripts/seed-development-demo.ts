import { seedDevelopmentDemo } from "../lib/development-demo";

const demo = await seedDevelopmentDemo();

console.log(
  `Seeded ChildLed development demo: organization=${demo.organizationId} child=${demo.childId}`,
);
