import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { hashPin } from "../src/lib/pin";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      passwordHash: await bcrypt.hash("changeme123", 10),
    },
  });
  console.log(`Admin user ready: ${admin.email} (password: changeme123)`);

  const generatorType = await prisma.generatorType.upsert({
    where: { id: "seed-type-standard" },
    update: {},
    create: {
      id: "seed-type-standard",
      name: "Standard 20kW Towable",
      tankCapacityGallons: 50,
      runtimeMinutes: 480, // 8 hours per full tank
    },
  });

  const oilChangeTag = await prisma.maintenanceTag.upsert({
    where: { id: "seed-tag-oil" },
    update: {},
    create: {
      id: "seed-tag-oil",
      name: "Oil Change",
      category: "OIL_CHANGE",
      description: "Routine oil change every 250 operating hours",
    },
  });

  const worker = await prisma.worker.upsert({
    where: { id: "seed-worker-1" },
    update: {},
    create: { id: "seed-worker-1", name: "Sam Fueler" },
  });
  await prisma.pinCredential.upsert({
    where: { pinHash: hashPin("11111") },
    update: {},
    create: { pinHash: hashPin("11111"), ownerType: "WORKER", ownerId: worker.id },
  });

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-1" },
    update: {},
    create: {
      id: "seed-customer-1",
      name: "Riverside Tailgate Club",
      email: "riverside@example.com",
      latitude: 39.9526,
      longitude: -75.1652,
    },
  });
  await prisma.pinCredential.upsert({
    where: { pinHash: hashPin("22222") },
    update: {},
    create: { pinHash: hashPin("22222"), ownerType: "CUSTOMER", ownerId: customer.id },
  });

  const generator = await prisma.generator.upsert({
    where: { id: "seed-generator-1" },
    update: {},
    create: {
      id: "seed-generator-1",
      label: "GEN-001",
      generatorTypeId: generatorType.id,
      latitude: 39.9526,
      longitude: -75.1652,
    },
  });

  await prisma.generatorMaintenanceTag.upsert({
    where: { id: "seed-gen-tag-1" },
    update: {},
    create: {
      id: "seed-gen-tag-1",
      generatorId: generator.id,
      maintenanceTagId: oilChangeTag.id,
    },
  });

  await prisma.assignment.upsert({
    where: { id: "seed-assignment-1" },
    update: {},
    create: {
      id: "seed-assignment-1",
      generatorId: generator.id,
      customerId: customer.id,
    },
  });

  console.log("Seed complete.");
  console.log(`Worker PIN: 11111 | Customer PIN: 22222`);
  console.log(`Scan URL: /scan/${generator.qrToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
