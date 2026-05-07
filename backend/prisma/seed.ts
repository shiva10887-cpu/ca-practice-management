import { PrismaClient, UserRole, BusinessType, ClientStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const org = await prisma.organisation.upsert({
    where: { email: 'admin@capractice.com' },
    update: {},
    create: {
      name: 'CA Practice Firm',
      email: 'admin@capractice.com',
      phone: '9876543210',
      address: '123 MG Road, Bengaluru',
      state: 'Karnataka',
      city: 'Bengaluru',
      pincode: '560001',
    },
  });

  const hashed = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@capractice.com' },
    update: {},
    create: {
      organisationId: org.id,
      email: 'admin@capractice.com',
      password: hashed,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
    },
  });

  console.log(`Created org: ${org.name}`);
  console.log(`Created admin: ${admin.email} / Admin@123`);

  // Sample clients
  const clientsData = [
    {
      name: 'Ramesh Kumar & Associates',
      pan: 'AABCP1234C',
      gstin: '29AABCP1234C1Z5',
      businessType: BusinessType.PARTNERSHIP,
      email: 'ramesh@example.com',
      phone: '9876543211',
      state: 'Karnataka',
    },
    {
      name: 'Priya Tech Solutions Pvt Ltd',
      pan: 'AAECP5678D',
      gstin: '29AAECP5678D1Z3',
      businessType: BusinessType.PRIVATE_LIMITED,
      email: 'priya@techsol.com',
      phone: '9876543212',
      state: 'Karnataka',
    },
    {
      name: 'Suresh Retail Traders',
      pan: 'ABCDS9012E',
      businessType: BusinessType.PROPRIETORSHIP,
      email: 'suresh@retail.com',
      phone: '9876543213',
      state: 'Tamil Nadu',
    },
  ];

  await prisma.client.createMany({
    data: clientsData.map((clientData) => ({
      ...clientData,
      organisationId: org.id,
      clientCode: `CL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      assignedManagerId: admin.id,
      status: ClientStatus.ACTIVE,
      complianceApplicability: ['GSTR1', 'GSTR3B', 'ITR'],
    })),
    skipDuplicates: true,
  });

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
