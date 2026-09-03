require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.user.update({
    where: { email: 'student@greenfield.test' },
    data: { firstName: 'Chidinma', lastName: 'Eze' },
  });
  console.log(`student@greenfield.test renamed to ${updated.firstName} ${updated.lastName}`);
}

main().finally(() => prisma.$disconnect());
