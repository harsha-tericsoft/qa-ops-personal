import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const baseURL = 'http://localhost:3000';

async function test(name, fn) {
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    console.log(`✓ ${name} (${duration}ms)`);
    return true;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('CRITICAL WORKFLOW VERIFICATION\n');

  let passed = 0;
  let total = 0;

  // Get test project
  let projectId = 'cmqttt49c000r7kygg73fmuqv';

  // Test 1: Load projects
  total++;
  if (await test('Load projects', async () => {
    const res = await axios.get(`${baseURL}/api/projects`);
    if (res.data.length === 0) throw new Error('No projects found');
  })) passed++;

  // Test 2: Load dashboard metrics
  total++;
  if (await test('Load repository metrics', async () => {
    const res = await axios.get(`${baseURL}/api/dashboard/repository-metrics?projectId=${projectId}`);
    if (!res.data.totalTests) throw new Error('No test data');
  })) passed++;

  // Test 3: Load test cases with pagination
  total++;
  if (await test('Load test cases (paginated)', async () => {
    const res = await axios.get(`${baseURL}/api/test-cases?projectId=${projectId}&page=1&limit=50`);
    if (!res.data.data || res.data.data.length === 0) throw new Error('No test cases in page 1');
  })) passed++;

  // Test 4: Load execution cycles
  total++;
  if (await test('Load execution cycles', async () => {
    const res = await axios.get(`${baseURL}/api/execution-cycles?projectId=${projectId}`);
    if (!Array.isArray(res.data)) throw new Error('Invalid cycles response');
  })) passed++;

  // Test 5: Load test suites
  total++;
  if (await test('Load test suites', async () => {
    const res = await axios.get(`${baseURL}/api/test-suites?projectId=${projectId}`);
    if (!Array.isArray(res.data)) throw new Error('Invalid suites response');
  })) passed++;

  // Test 6: Load repository tree
  total++;
  if (await test('Load repository tree', async () => {
    const res = await axios.get(`${baseURL}/api/repository/tree?projectId=${projectId}`);
    if (!res.data.success) throw new Error('Tree load failed');
  })) passed++;

  // Test 7: Database connectivity
  total++;
  if (await test('Database connectivity', async () => {
    const count = await prisma.roamTestCase.count({ where: { projectId } });
    if (count === 0) throw new Error('No test cases in database');
  })) passed++;

  // Test 8: Create a test suite
  total++;
  if (await test('Create test suite', async () => {
    // Get some test case IDs first
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      select: { id: true },
      take: 5,
    });

    if (testCases.length === 0) throw new Error('No test cases available');

    const res = await axios.post(`${baseURL}/api/test-suites?projectId=${projectId}`, {
      name: `Test Suite ${Date.now()}`,
      category: 'CUSTOM',
      testIds: testCases.map(tc => tc.id),
    });

    if (!res.data.id) throw new Error('Suite creation failed');
  })) passed++;

  // Test 9: Create an execution cycle
  total++;
  if (await test('Create execution cycle', async () => {
    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      select: { id: true },
      take: 10,
    });

    if (testCases.length === 0) throw new Error('No test cases available');

    const res = await axios.post(`${baseURL}/api/execution-cycles?projectId=${projectId}`, {
      name: `Test Cycle ${Date.now()}`,
      testCaseIds: testCases.map(tc => tc.id),
    });

    if (!res.data.id) throw new Error('Cycle creation failed');
  })) passed++;

  // Test 10: Data consistency - RoamTestCase vs TestCase counts
  total++;
  if (await test('Data consistency check', async () => {
    const roamCount = await prisma.roamTestCase.count({ where: { projectId } });
    const testCount = await prisma.testCase.count({ where: { projectId } });

    // After sync, TestCase should be >= RoamTestCase
    if (testCount < roamCount) {
      throw new Error(`Count mismatch: RoamTestCase=${roamCount}, TestCase=${testCount}`);
    }
  })) passed++;

  console.log(`\nRESULTS: ${passed}/${total} tests passed`);
  console.log(`${passed === total ? '✓ READY FOR PRODUCTION' : '✗ ISSUES FOUND'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
