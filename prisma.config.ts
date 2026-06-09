import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // For development with pgbouncer, we can use accelerateUrl or rely on the service's pooling
  // Using Prisma Accelerate for better connection management
  accelerate: {
    enabled: process.env.PRISMA_ACCELERATE_URL ? true : false,
  },
});
