import { PrismaClient, ModuleStatus, MainlineType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create sample modules
  const modules = [
    {
      name: 'React UI Components',
      description: 'A collection of reusable React components for building modern web applications',
      numberOfEndplates: 2,
      numberOfMainlines: MainlineType.SINGLE,
      status: ModuleStatus.ACTIVE,
      category: 'Frontend',
      owner: 'UI Team',
      location: 'https://github.com/company/react-ui-components',
      documentation: 'https://docs.company.com/ui-components',
      dependencies: ['react', 'typescript', 'tailwindcss']
    },
    {
      name: 'Authentication Service',
      description: 'Microservice for handling user authentication and authorization',
      numberOfEndplates: 4,
      numberOfMainlines: MainlineType.DOUBLE,
      status: ModuleStatus.ACTIVE,
      category: 'Backend',
      owner: 'Security Team',
      location: 'https://github.com/company/auth-service',
      documentation: 'https://docs.company.com/auth-service',
      dependencies: ['node', 'express', 'jwt', 'bcrypt']
    },
    {
      name: 'Data Processing Pipeline',
      description: 'ETL pipeline for processing large datasets with Apache Spark',
      numberOfEndplates: 8,
      numberOfMainlines: MainlineType.DOUBLE,
      status: ModuleStatus.DEVELOPMENT,
      category: 'Data',
      owner: 'Data Engineering Team',
      location: 'https://github.com/company/data-pipeline',
      dependencies: ['spark', 'scala', 'kafka']
    },
    {
      name: 'Legacy Payment Gateway',
      description: 'Legacy payment processing system - deprecated in favor of new payment service',
      numberOfEndplates: 2,
      numberOfMainlines: MainlineType.SINGLE,
      status: ModuleStatus.DEPRECATED,
      category: 'Backend',
      owner: 'Payments Team',
      location: 'https://github.com/company/legacy-payment-gateway',
      dependencies: ['java', 'spring', 'hibernate']
    },
    {
      name: 'Mobile SDK',
      description: 'Cross-platform mobile SDK for integrating with our APIs',
      numberOfEndplates: 3,
      numberOfMainlines: MainlineType.SINGLE,
      status: ModuleStatus.DEVELOPMENT,
      category: 'Mobile',
      owner: 'Mobile Team',
      location: 'https://github.com/company/mobile-sdk',
      documentation: 'https://docs.company.com/mobile-sdk',
      dependencies: ['react-native', 'expo', 'typescript']
    },
    {
      name: 'Analytics Dashboard',
      description: 'Real-time analytics dashboard for monitoring application performance',
      numberOfEndplates: 6,
      numberOfMainlines: MainlineType.DOUBLE,
      status: ModuleStatus.ACTIVE,
      category: 'Analytics',
      owner: 'Analytics Team',
      location: 'https://github.com/company/analytics-dashboard',
      documentation: 'https://docs.company.com/analytics',
      dependencies: ['vue', 'chartjs', 'websocket']
    }
  ]

  console.log('Seeding database with sample modules...')

  for (const moduleData of modules) {
    await prisma.module.create({
      data: moduleData
    })
    console.log(`✓ Created module: ${moduleData.name}`)
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
