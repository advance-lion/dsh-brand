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
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, parse } from 'node:path'

export const name = 'dsh-brand'
export const inject = ['webServer']

const FILE_NAME = 'dsh-brand.json'
const LIMITS = {
  name: 100000,
  version: 100000,
  useDshVersion: 8,
  headline: 100000,
  badge: 100000,
  intro: 100000,
  logoText: 8,
  logoUrl: 200000,
  title: 60,
  favicon: 200000,
  sendIcon: 200000,
  stopIcon: 200000,
  hideNotice: 8,
  thinkText: 60,
  colorEnabled: 8,
  colorTargets: 160,
  color: 32,
}
const KEYS = Object.keys(LIMITS)

/** @returns every field empty (stock GUI branding). */
function defaults() {
  return { name: '', version: '', useDshVersion: 'true', headline: '', badge: '', intro: '', logoText: '', logoUrl: '', title: '', favicon: '', sendIcon: '', stopIcon: '', hideNotice: '', thinkText: '', colorEnabled: 'true', colorTargets: 'sidebar,project,think,diving,composer', color: '' }
}

/** Resolve the running DSH build badge without persisting it in brand config. */
function dshBuildVersion() {
  const explicit = typeof process.env.DSH_CLIENT_COMMIT_HASH === 'string' ? process.env.DSH_CLIENT_COMMIT_HASH.trim() : ''
  if (/^[0-9a-f]{7,40}$/i.test(explicit)) return explicit.slice(0, 7)
  let current = dirname(process.argv[1] || process.cwd())
  const root = parse(current).root
  while (current !== root) {
    if (existsSync(join(current, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(current, 'package.json'), 'utf8'))
        if (pkg && (pkg.name === '@deepseek-ai/dsh' || pkg.name === 'deepseek-harness')) {
          try {
            return execFileSync('git', ['-C', current, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
          } catch {
            if (typeof pkg.version === 'string' && pkg.version !== '') return pkg.version
          }
        }
      } catch { /* continue walking */ }
    }
    current = dirname(current)
  }
  return ''
}

const DSH_BUILD_VERSION = dshBuildVersion()
function publicConfig() {
  return { ...readConfig(), dshBuildVersion: DSH_BUILD_VERSION }
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
  // Auto-convert raw SVG markup to data URLs for image-capable fields.
  const imageFields = ['logoUrl', 'favicon', 'sendIcon', 'stopIcon', 'name', 'version', 'headline', 'badge', 'intro']
  for (const f of imageFields) {
    if (/<svg/i.test(out[f])) out[f] = ('data:image/svg+xml,' + encodeURIComponent(out[f])).slice(0, LIMITS[f])
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
          sendJson(res, 200, publicConfig())
          return
        }
        if (req.method === 'PUT' || req.method === 'POST') {
          if (!sameOrigin(req)) {
            sendJson(res, 403, { error: 'untrusted origin' })
            return
          }
          const cfg = sanitize(await readBody(req))
          writeConfig(cfg)
          sendJson(res, 200, { ...cfg, dshBuildVersion: DSH_BUILD_VERSION })
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
    const cfg = publicConfig()
    const json = JSON.stringify(cfg).replace(/</g, '\\u003c')
    const tag = `<script>window.__DSH_BRAND__=${json};</` + 'script>'
    let out = html
    // Replace the static <title> tag with the configured product title.
    if (cfg.title !== '') {
      const titleText = cfg.title.replace(/</g, '&lt;')
      out = out.replace(/<title>[^<]*<\/title>/, '<title>' + titleText + '</title>')
    }
    // Replace the favicon link href with the configured icon (if any).
    const favicon = cfg.favicon !== '' ? cfg.favicon : cfg.logoUrl
    if (favicon !== '') {
      const fav = favicon.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
      out = out.replace(/(<link\s+rel="icon"[^>]*href=")[^"]*"/, '$1' + fav + '"')
    }
    const at = out.indexOf('</head>')
    return at === -1 ? out + tag : out.slice(0, at) + tag + out.slice(at)
  }), 'dsh-brand: index config injection')
}
