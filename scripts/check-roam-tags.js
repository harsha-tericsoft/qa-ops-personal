require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkRoamTags() {
  console.log('🔍 CHECKING ROAM TEST CASE TAGS')
  console.log('================================\n')

  try {
    // 1. Check if RoamTestCase has tags
    console.log('1️⃣  Checking RoamTestCase tags...\n')

    const roamTestCases = await prisma.roamTestCase.findMany({
      select: {
        id: true,
        title: true,
        tags: true,
      },
      take: 10,
    })

    const roamWithTags = roamTestCases.filter((rtc) => rtc.tags && rtc.tags.length > 0)

    console.log(`Total RoamTestCases with tags: ${roamWithTags.length}`)
    console.log('\nSample RoamTestCases:')
    roamWithTags.forEach((rtc) => {
      console.log(`\n  Title: ${rtc.title}`)
      console.log(`  Tags: ${rtc.tags?.join(', ') || 'NONE'}`)
    })

    // 2. Get all unique tags
    console.log('\n\n2️⃣  Extracting unique tags...\n')

    const allRoamTestCases = await prisma.roamTestCase.findMany({
      select: { tags: true },
    })

    const allRoamWithTags = allRoamTestCases.filter((rtc) => rtc.tags && rtc.tags.length > 0)

    const uniqueTags = new Set()
    allRoamWithTags.forEach((rtc) => {
      rtc.tags?.forEach((tag) => uniqueTags.add(tag))
    })

    console.log(`Total unique tags found: ${uniqueTags.size}`)
    console.log('\nAll unique tags:')
    Array.from(uniqueTags)
      .sort()
      .forEach((tag) => {
        console.log(`  - ${tag}`)
      })

    // 3. Count tests per tag (what the migration will create)
    console.log('\n\n3️⃣  Tag distribution (what migration will create)...\n')

    const tagCounts = {}
    allRoamTestCases.forEach((rtc) => {
      rtc.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })

    console.log('Tag Counts:')
    Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tag, count]) => {
        console.log(`  ${tag}: ${count}`)
      })

    console.log('\n\n✅ Tag data is ready for migration')
    console.log(`✅ ${uniqueTags.size} unique tags`)
    console.log(`✅ ${Object.values(tagCounts).reduce((a, b) => a + b, 0)} total tag assignments`)
  } catch (error) {
    console.error('❌ ERROR:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkRoamTags()
