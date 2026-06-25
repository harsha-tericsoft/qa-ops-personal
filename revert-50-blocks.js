#!/usr/bin/env node

/**
 * REVERT: Restore 50 blocks to original state
 * Due to shell escaping issue with special characters
 */

const { execSync } = require('child_process')
const fs = require('fs')

const GRAPH_NAME = 'Project_Kinergy'
const BACKUP_FILE = 'roam-testcase-backup.json'
const PREVIEW_FILE = 'roam-testcase-update-preview.json'

function extractJsonFromOutput(output) {
  const lines = output.split('\n')
  const jsonStart = lines.findIndex((l) => l.startsWith('{'))
  if (jsonStart < 0) return null
  try {
    return JSON.parse(lines.slice(jsonStart).join('\n'))
  } catch (e) {
    return null
  }
}

async function revert() {
  console.log('=' .repeat(70))
  console.log('REVERT: Restoring 50 blocks to original state')
  console.log('=' .repeat(70))
  console.log('')

  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'))
  const preview = JSON.parse(fs.readFileSync(PREVIEW_FILE, 'utf8'))

  // Get first 50 blocks that were updated
  const updates = preview.updates.filter(
    (u) => u.action !== 'SKIP_ALREADY_CORRECT' && u.changed
  ).slice(0, 50)

  console.log(`Reverting ${updates.length} blocks...`)
  console.log('')

  let reverted = 0
  for (let i = 0; i < updates.length; i++) {
    const update = updates[i]

    // Find original text in backup
    const original = backup.blocks.find((b) => b.uid === update.uid)
    if (!original) {
      console.log(`  ⚠️  Block ${update.uid} not found in backup`)
      continue
    }

    try {
      // Revert to original text
      // Extract just the text part without roam tags
      const originalText = original.markdown.split('<roam')[0].replace(/^-\s*/, '').trim()

      // Use Node.js child_process with proper escaping
      execSync(
        `roam update-block --uid "${update.uid}" --string "${originalText.replace(/"/g, '\\"')}" --graph "${GRAPH_NAME}"`,
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      )

      reverted++

      if ((i + 1) % 10 === 0) {
        console.log(`  Reverted ${i + 1}/${updates.length}...`)
      }
    } catch (e) {
      console.log(`  ERROR reverting ${update.uid}: ${e.message.substring(0, 50)}`)
    }
  }

  console.log()
  console.log(`✓ Reverted ${reverted} blocks`)
  console.log()
  console.log('Ready for re-run with fixed escaping...')
}

revert().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
