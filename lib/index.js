/**
 * dsh-brand host half: serves the brand configuration over a local HTTP API.
 *
 * The config lives at `$DSH_HOME/dsh-brand.json` (default `~/.dsh/dsh-brand.json`)
 * so one file brands every workspace and can be shipped as-is by downstream
 * forks. All fields are optional strings; an empty field keeps the stock GUI
 * fallback for that slot.
 *
 * Routes:
 *  - GET  /api/dsh-brand/config   -> the sanitized config object
 *  - PUT  /api/dsh-brand/config   <- a full or partial config object; writes
 *                                    the file and returns the sanitized result
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const name = 'dsh-brand'
export const inject = ['webServer']

const FILE_NAME = 'dsh-brand.json'
const LIMITS = {
  name: 60,
  version: 30,
  headline: 60,
  badge: 20,
  intro: 120,
  logoText: 8,
  logoUrl: 200000,
  title: 60,
}
const KEYS = Object.keys(LIMITS)

/** @returns every field empty (stock GUI branding). */
function defaults() {
  return { name: '', version: '', headline: '', badge: '', intro: '', logoText: '', logoUrl: '', title: '' }
}

/**
 * Keep only known string fields, trimmed to their per-field caps.
 * @param input - untrusted parsed JSON.
 * @returns a complete config object.
 */
function sanitize(input) {
  const out = defaults()
  if (input === null || typeof input !== 'object') return out
  for (const key of KEYS) {
    const value = input[key]
    if (typeof value === 'string') out[key] = value.slice(0, LIMITS[key])
  }
  return out
}

/** Absolute path of the config file: $DSH_HOME/dsh-brand.json, defaulting to ~/.dsh. */
function configPath() {
  const env = process.env.DSH_HOME
  const home = typeof env === 'string' && env.trim() !== '' ? env : join(homedir(), '.dsh')
  return join(home, FILE_NAME)
}

/** Read the config file; any failure (missing, malformed) yields the defaults. */
function readConfig() {
  try {
    const path = configPath()
    if (!existsSync(path)) return defaults()
    return sanitize(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return defaults()
  }
}

/** Persist the config, creating $DSH_HOME when needed. */
function writeConfig(cfg) {
  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Collect a JSON request body with a hard 512 KB ceiling. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = ''
    req.on('data', (chunk) => {
      text += chunk
      if (text.length > 512 * 1024) {
        reject(new Error('request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(text === '' ? {} : JSON.parse(text))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/**
 * Mutations require a same-origin browser call: requests with no Origin header
 * (same-origin navigations, curl) pass; a cross-site Origin must not.
 */
function sameOrigin(req) {
  const origin = req.headers?.origin
  if (typeof origin !== 'string' || origin === '') return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-brand/config',
    handler: async (req, res) => {
      try {
        if (req.method === 'GET') {
          sendJson(res, 200, readConfig())
          return
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          if (!sameOrigin(req)) {
            sendJson(res, 403, { error: 'untrusted origin' })
            return
          }
          const cfg = sanitize(await readBody(req))
          writeConfig(cfg)
          sendJson(res, 200, cfg)
          return
        }
        res.writeHead(405, { allow: 'GET, PUT, POST' })
        res.end()
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-brand: config route')

  // Stamp the current config into the served HTML so the client bundle applies
  // branding synchronously at boot — no fallback-logo flash while a fetch is
  // in flight. `<` is escaped so config text can never break out of the tag.
  ctx.effect(() => ctx.webServer.tapIndex((html) => {
    const json = JSON.stringify(readConfig()).replace(/</g, '\\u003c')
    const tag = `<script>window.__DSH_BRAND__=${json};</` + 'script>'
    const at = html.indexOf('</head>')
    return at === -1 ? html + tag : html.slice(0, at) + tag + html.slice(at)
  }), 'dsh-brand: index config injection')
}
