import { prisma } from '@/lib/prisma'

async function diagnose() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('DIAGNOSTIC CHECK - Internal Server Error Investigation')
  console.log('═══════════════════════════════════════════════════════════\n')

  const checks = {
    database: { status: '?', message: '' },
    executionVersion: { status: '?', message: '' },
    testRun: { status: '?', message: '' },
    enums: { status: '?', message: '' },
    testSuite: { status: '?', message: '' },
  }

  // 1. Database connection
  try {
    console.log('Checking database connection...')
    await prisma.$queryRaw`SELECT 1`
    checks.database.status = '✓'
    checks.database.message = 'Database connected'
    console.log('✓ Database connection OK\n')
  } catch (error) {
    checks.database.status = '✗'
    checks.database.message = error instanceof Error ? error.message : 'Unknown error'
    console.log(`✗ Database connection FAILED: ${checks.database.message}\n`)
  }

  // 2. ExecutionVersion table
  try {
    console.log('Checking ExecutionVersion table...')
    const count = await prisma.executionVersion.count()
    checks.executionVersion.status = '✓'
    checks.executionVersion.message = `Table exists, ${count} rows`
    console.log(`✓ ExecutionVersion table OK (${count} rows)\n`)
  } catch (error) {
    checks.executionVersion.status = '✗'
    checks.executionVersion.message = 'Table missing - run: npx prisma migrate deploy'
    console.log(`✗ ExecutionVersion table MISSING\n   Fix: npx prisma migrate deploy\n`)
  }

  // 3. TestRun versionId column
  try {
    console.log('Checking TestRun.versionId column...')
    const run = await prisma.testRun.findFirst({
      select: { versionId: true },
    })
    checks.testRun.status = '✓'
    checks.testRun.message = 'Column exists'
    console.log('✓ TestRun.versionId column OK\n')
  } catch (error) {
    checks.testRun.status = '✗'
    checks.testRun.message = 'Column missing - migration not applied'
    console.log(`✗ TestRun.versionId column MISSING\n   Fix: npx prisma migrate deploy\n`)
  }

  // 4. Enum values
  try {
    console.log('Checking enum values...')
    const versions = await prisma.executionVersion.findMany({
      select: { status: true },
      take: 1,
    })
    const runs = await prisma.testRun.findMany({
      select: { status: true },
      take: 1,
    })
    checks.enums.status = '✓'
    checks.enums.message = 'Enums valid'
    console.log('✓ Enum values OK\n')
  } catch (error) {
    checks.enums.status = '✗'
    checks.enums.message = 'Enum check failed'
    console.log(`✗ Enum check FAILED\n   Error: ${error instanceof Error ? error.message : 'Unknown'}\n`)
  }

  // 5. Test suite accessibility
  try {
    console.log('Checking test suite accessibility...')
    const count = await prisma.testSuite.count()
    checks.testSuite.status = '✓'
    checks.testSuite.message = `Accessible, ${count} suites`
    console.log(`✓ Test suites accessible (${count} total)\n`)
  } catch (error) {
    checks.testSuite.status = '✗'
    checks.testSuite.message = error instanceof Error ? error.message : 'Unknown error'
    console.log(`✗ Test suite error: ${checks.testSuite.message}\n`)
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════')
  console.log('DIAGNOSTIC SUMMARY')
  console.log('═══════════════════════════════════════════════════════════\n')

  Object.entries(checks).forEach(([check, result]) => {
    console.log(`${result.status} ${check.padEnd(20)} : ${result.message}`)
  })

  const failed = Object.values(checks).filter((c) => c.status === '✗').length
  console.log(`\n${failed === 0 ? '✓ All checks passed' : `✗ ${failed} check(s) failed`}\n`)

  // Recommendations
  console.log('─────────────────────────────────────────────────────────────')
  console.log('RECOMMENDATIONS')
  console.log('─────────────────────────────────────────────────────────────\n')

  if (checks.database.status === '✗') {
    console.log('1. Database not connected')
    console.log('   - Check DATABASE_URL in .env.local')
    console.log('   - Verify Supabase account is active')
    console.log('   - Test connection: npx prisma db execute --stdin < /dev/null\n')
  }

  if (checks.executionVersion.status === '✗' || checks.testRun.status === '✗') {
    console.log('2. Migration not applied')
    console.log('   - Run: npx prisma migrate deploy')
    console.log('   - This creates ExecutionVersion table')
    console.log('   - This adds versionId column to TestRun')
    console.log('   - This creates ExecutionStatus and TestRunStatus enums\n')
  }

  if (checks.enums.status === '✗') {
    console.log('3. Enum values invalid')
    console.log('   - Check schema.prisma for correct enum values')
    console.log('   - Regenerate Prisma client: npx prisma generate\n')
  }

  console.log('NEXT STEPS:')
  console.log('1. Run: npx prisma migrate deploy')
  console.log('2. Run: npx prisma generate')
  console.log('3. Restart dev server: npm run dev')
  console.log('4. Try the operation again\n')

  process.exit(failed === 0 ? 0 : 1)
}

diagnose().catch((error) => {
  console.error('Diagnostic failed:', error)
  process.exit(1)
})
