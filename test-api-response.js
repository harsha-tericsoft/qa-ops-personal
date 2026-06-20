const { spawn } = require('child_process')

const projectId = '79d857b2-36dd-4810-88ae-3ca8d9aaa8d4'

async function curl(path) {
  return new Promise((resolve) => {
    const args = ['-s', `http://localhost:3000${path}`]
    const proc = spawn('curl', args)
    let output = ''
    proc.stdout.on('data', (d) => { output += d })
    proc.on('close', () => {
      try {
        resolve(JSON.parse(output))
      } catch {
        resolve(null)
      }
    })
  })
}

async function test() {
  try {
    const res = await curl(`/api/execution-cycles?projectId=${projectId}`)
    
    console.log('API_RESPONSE')
    console.log(JSON.stringify(res, null, 2).substring(0, 1000))
    console.log('...')
    console.log('')

    console.log('VERIFICATION')
    if (Array.isArray(res) && res.length > 0) {
      const cycle = res[0]
      console.log('Sample Cycle:')
      console.log('- ID: ' + cycle.id)
      console.log('- Name: ' + cycle.name)
      console.log('- Has testRuns property: ' + (cycle.testRuns !== undefined ? 'YES ✓' : 'NO ✗'))
      console.log('- testRuns is array: ' + (Array.isArray(cycle.testRuns) ? 'YES ✓' : 'NO ✗'))
      console.log('- testRuns.length: ' + (cycle.testRuns?.length || 0))
    }

  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  }
}

test()
