const http = require('http')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'cmqttt49c000r7kygg73fmuqv'

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data })
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function test() {
  console.log('Creating suite...')
  const createRes = await makeRequest('POST', `/api/test-suites?projectId=${PROJECT_ID}`, {
    name: `Debug Suite ${Date.now()}`,
    category: 'CUSTOM',
    roamTestCaseIds: [],
  })

  const suite = JSON.parse(createRes.body)
  console.log(`Created: ${suite.id}`)

  console.log('Deleting suite...')
  const deleteRes = await makeRequest('DELETE', `/api/test-suites/${suite.id}`)
  console.log(`Status: ${deleteRes.status}`)
  console.log(`Response: ${deleteRes.body}`)
}

test().catch(console.error)
