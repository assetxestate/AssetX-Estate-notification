import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

config({ path: path.join(rootDir, '.env.local'), quiet: true })
config({ path: path.join(rootDir, '.env'), quiet: true })

const viteOrigin = process.env.VITE_ORIGIN || 'http://127.0.0.1:5173'
const port = Number(process.env.LOCAL_API_PORT || 5175)

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function createResponseAdapter(nativeRes) {
  return {
    headersSent: false,
    setHeader(name, value) {
      nativeRes.setHeader(name, value)
    },
    status(code) {
      nativeRes.statusCode = code
      return this
    },
    json(data) {
      this.headersSent = true
      nativeRes.setHeader('Content-Type', 'application/json; charset=utf-8')
      nativeRes.end(JSON.stringify(data))
    },
    write(chunk) {
      this.headersSent = true
      nativeRes.write(chunk)
    },
    end(chunk) {
      this.headersSent = true
      nativeRes.end(chunk)
    },
  }
}

async function handleApi(req, res, requestUrl) {
  const { pathname, searchParams } = requestUrl
  const route = pathname.replace(/^\/api\//, '').replace(/[^a-z0-9_-]/gi, '')
  const apiPath = path.join(rootDir, 'api', `${route}.js`)
  const mod = await import(`${pathToFileURL(apiPath).href}?t=${Date.now()}`)
  const rawBody = await readBody(req)
  const contentType = req.headers['content-type'] || ''
  const body = rawBody && contentType.includes('application/json') ? JSON.parse(rawBody) : rawBody
  const query = Object.fromEntries(searchParams.entries())
  await mod.default({ method: req.method, headers: req.headers, body, query }, createResponseAdapter(res))
}

async function proxyToVite(req, res) {
  const target = new URL(req.url || '/', viteOrigin)
  const response = await fetch(target, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req),
    redirect: 'manual',
  })

  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
    const { pathname } = requestUrl
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, requestUrl)
      return
    }
    await proxyToVite(req, res)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: error.message || 'Local dev server error' }))
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`AssetX local app + API: http://127.0.0.1:${port}/`)
  console.log(`Proxying frontend from ${viteOrigin}`)
})
