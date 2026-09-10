/**
 * dsh-brand client bundle (official dsh client-package shape):
 * window.__ModuleLoader__.load({ id, factory }) with `require` resolving the
 * shell's shared externals ("react" here; see apps web platform seed table).
 *
 * Replaces the GUI branding through the stock brand slots:
 *  - sidebar.brand.mark / sidebar.brand.name  (logo, name, version badge)
 *  - conversation.hero.brand.mark             (hero logo; when any hero text
 *    field is set, the occupant renders the whole headline row and a scoped
 *    stylesheet hides the shell's stock headline/badge spans)
 *  - document.title                           (tab title, re-asserted because
 *    the shell rewrites it on every session change)
 * Config arrives from GET /api/dsh-brand/config; the settings page writes it
 * back with PUT. Every registration is disposed on unload.
 */
window.__ModuleLoader__.load({
  id: 'dsh-brand',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const API = '/api/dsh-brand/config'
    const KEYS = ['name', 'version', 'headline', 'badge', 'intro', 'logoText', 'logoUrl', 'title', 'favicon', 'hideNotice']

    /** Every field empty: stock GUI branding. */
    function blank() {
      return { name: '', version: '', headline: '', badge: '', intro: '', logoText: '', logoUrl: '', title: '', favicon: '', hideNotice: '' }
    }

    /** Keep only known string fields (server already caps their length). */
    function clean(input) {
      const out = blank()
      if (input === null || typeof input !== 'object') return out
      for (const key of KEYS) {
        const value = input[key]
        if (typeof value === 'string') out[key] = value
      }
      return out
    }

    /**
     * If the value is raw SVG markup (starts with <svg), wrap it in a
     * data URL so it works as an <img src> / <link href>. Already-valid
     * URLs (http:, data:, /) pass through unchanged.
     */
    function ensureDataUrl(value) {
      if (typeof value !== 'string' || value === '') return ''
      if (/^(https?:|data:|\/|blob:)/i.test(value)) return value
      if (/<svg/i.test(value)) return 'data:image/svg+xml,' + encodeURIComponent(value)
      return value
    }

    /** The logo: an image when logoUrl is set, else a logoText / first-name-letter tile. */
    function markElement(cfg, size) {
      const src = ensureDataUrl(cfg.logoUrl)
      if (src !== '') {
        return h('img', {
          className: 'dsh-brand-markimg',
          src: src,
          alt: cfg.name !== '' ? cfg.name : 'brand',
          width: size,
          height: size,
        })
      }
      let text = cfg.logoText
      if (text === '' && cfg.name !== '') text = Array.from(cfg.name)[0]
      if (text === '') return null
      return h('span', {
        className: 'dsh-brand-letter',
        style: { width: size + 'px', height: size + 'px', fontSize: Math.max(10, Math.round(size * 0.52)) + 'px' },
      }, text)
    }

    /** Sidebar name row: product name plus the version badge (single host element — slot-safe). */
    function nameElement(cfg) {
      return h('span', { className: 'dsh-brand-namewrap' },
        cfg.name !== '' ? h('span', { className: 'dsh-brand-nametext' }, cfg.name) : null,
        cfg.version !== '' ? h('span', { className: 'dsh-brand-versionbadge' }, cfg.version) : null)
    }

    /** Hero takeover: logo + headline + badge row, with the intro line below. */
    function heroElement(cfg, size) {
      const row = h('div', { className: 'dsh-brand-hero-row' },
        markElement(cfg, size),
        cfg.headline !== '' ? h('span', { className: 'dsh-brand-hero-text' }, cfg.headline) : null,
        cfg.badge !== '' ? h('span', { className: 'dsh-brand-hero-badge' }, cfg.badge) : null)
      return h('div', { className: 'dsh-brand-hero' }, row,
        cfg.intro !== '' ? h('div', { className: 'dsh-brand-hero-intro' }, cfg.intro) : null)
    }

    /**
     * The package stylesheet. When any hero text field is set, the stock hero
     * headline/badge spans (siblings of the slot's host span) are hidden and
     * the host span is flattened into the headline grid — no class-name
     * guessing against CSS-module hashes.
     */
    function buildCss(cfg) {
      const heroOverride = cfg.headline !== '' || cfg.badge !== '' || cfg.intro !== ''
      let css = ''
      css += '.dsh-brand-markimg{display:block;border-radius:6px;object-fit:contain;}'
      css += '.dsh-brand-letter{display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-label-primary-bluish);font-weight:700;line-height:1;}'
      css += '.dsh-brand-namewrap{display:contents;}'
      css += '.dsh-brand-nametext{font-size:17px;letter-spacing:0;white-space:nowrap;color:var(--dsw-alias-label-primary);}'
      css += '.dsh-brand-versionbadge{display:inline-flex;align-items:center;height:16px;padding:0 4px;border-radius:3px;color:var(--dsw-alias-label-primary-inverted);background:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:8px;font-weight:500;line-height:16px;white-space:nowrap;}'
      css += '.dsh-brand-hero{grid-column:1 / -1;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;}'
      css += '.dsh-brand-hero-row{display:flex;align-items:center;justify-content:center;gap:10px;font-size:26px;line-height:32px;font-weight:500;color:var(--dsw-alias-label-primary);}'
      css += '.dsh-brand-hero-text{white-space:nowrap;}'
      css += '.dsh-brand-hero-badge{padding:1px 7px 0;border:1px solid var(--dsw-alias-interactive-bg-hover);border-radius:24px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-label-primary-bluish);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;font-weight:500;white-space:nowrap;}'
      css += '.dsh-brand-hero-intro{font-size:14px;line-height:20px;font-weight:400;color:var(--dsw-alias-label-caption);text-align:center;}'
      css += '.dsh-brand-form{display:flex;flex-direction:column;gap:14px;max-width:480px;padding:8px 0;}'
      css += '.dsh-brand-field{display:flex;flex-direction:column;gap:6px;}'
      css += '.dsh-brand-field-label{font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary);}'
      css += '.dsh-brand-field-input{box-sizing:border-box;width:100%;height:38px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;outline:none;font-family:inherit;}'
      css += '.dsh-brand-field-input:focus{border-color:var(--dsw-alias-interactive-bg-hover);}'
      css += '.dsh-brand-actions{display:flex;align-items:center;gap:10px;margin-top:4px;}'
      css += '.dsh-brand-btn{min-width:88px;height:34px;padding:0 16px;border:none;border-radius:17px;font-size:13px;font-weight:500;cursor:pointer;}'
      css += '.dsh-brand-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary-inverted);}'
      css += '.dsh-brand-btn-plain{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);}'
      css += '.dsh-brand-status{font-size:12px;color:var(--dsw-alias-label-caption);}'
      css += '.dsh-brand-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption);}'
      css += '.dsh-brand-field-row{flex-direction:row;align-items:center;gap:10px;}'
      css += '.dsh-brand-checkbox{width:18px;height:18px;cursor:pointer;accent-color:var(--dsw-alias-label-primary);}'
      if (heroOverride) {
        css += 'span:has(.dsh-brand-hero){display:contents !important;}'
        css += 'span:has(.dsh-brand-hero) ~ span{display:none !important;}'
      }
      return css
    }

    /** Keep the tab title on the brand name; the shell rewrites it per session. */
    function syncTitle(cfg) {
      if (cfg.title === '') return
      const current = String(document.title || '')
      const sep = current.lastIndexOf(' — ')
      const next = sep >= 0 ? current.slice(0, sep) + ' — ' + cfg.title : cfg.title
      if (next !== current) document.title = next
    }

    /** Update the browser tab icon to the configured favicon (if any). */
    function syncFavicon(cfg) {
      const fav = ensureDataUrl(cfg.favicon !== '' ? cfg.favicon : cfg.logoUrl)
      if (fav === '') return
      let link = document.querySelector('link[rel="icon"]')
      if (link === null) {
        link = document.createElement('link')
        link.setAttribute('rel', 'icon')
        document.head.appendChild(link)
      }
      if (link.getAttribute('href') !== fav) link.setAttribute('href', fav)
    }

    /**
     * Replacement for the shipped welcome-notice onboarding step: renders
     * nothing and immediately signals completion so the onboarding
     * coordinator advances past it — no dialog, no inert root.
     */
    function SuppressedNotice(props) {
      React.useEffect(() => {
        if (props !== null && typeof props === 'object' && typeof props.complete === 'function') {
          props.complete()
        }
      }, [])
      return null
    }

    function apply(ctx) {
      const slots = ctx.slots
      const disposers = []
      let teardown = null
      let styleEl = null

      function ensureStyle(css) {
        if (styleEl === null) {
          styleEl = document.createElement('style')
          styleEl.setAttribute('data-dsh-brand', '')
          document.head.appendChild(styleEl)
        }
        styleEl.textContent = css
      }

      /** (Re)apply one config: style tag, brand slots, tab title. */
      function applyConfig(cfg) {
        if (teardown !== null) { teardown(); teardown = null }
        const next = []
        ensureStyle(buildCss(cfg))
        const hasMark = cfg.logoUrl !== '' || cfg.logoText !== '' || cfg.name !== ''
        const hasName = cfg.name !== '' || cfg.version !== ''
        const heroOverride = cfg.headline !== '' || cfg.badge !== '' || cfg.intro !== ''
        // Each seat registers independently: one bad seat must not strand the rest.
        const seat = (slotName, component) => {
          try {
            next.push(slots.inject(slotName, () => slots.register({ name: slotName }, component)))
          } catch (error) {
            console.error('[dsh-brand] registration failed for ' + slotName + ':', error)
          }
        }
        if (hasMark) {
          seat('sidebar.brand.mark',
            (props) => markElement(cfg, props !== null && typeof props === 'object' && typeof props.size === 'number' ? props.size : 24))
        }
        if (hasName) {
          seat('sidebar.brand.name', () => nameElement(cfg))
        }
        if (heroOverride) {
          seat('conversation.hero.brand.mark',
            (props) => heroElement(cfg, props !== null && typeof props === 'object' && typeof props.size === 'number' ? props.size : 34))
        } else if (hasMark) {
          seat('conversation.hero.brand.mark',
            (props) => markElement(cfg, props !== null && typeof props === 'object' && typeof props.size === 'number' ? props.size : 34))
        }
        if (cfg.title !== '') {
          syncTitle(cfg)
          const timer = window.setInterval(() => syncTitle(cfg), 800)
          next.push(() => window.clearInterval(timer))
        }
        // Suppress the shipped "内测声明" onboarding dialog by replacing its
        // slot entry with a null-rendering component that signals completion.
        if (cfg.hideNotice === 'true') {
          try {
            next.push(slots.inject('settings.onboarding', () => slots.register(
              { name: 'settings.onboarding', id: 'welcome-notice', order: -1, priority: 1 },
              SuppressedNotice,
            )))
          } catch (error) {
            console.error('[dsh-brand] registration failed for settings.onboarding/welcome-notice:', error)
          }
        }
        // Replace the browser tab icon.
        if (cfg.favicon !== '') syncFavicon(cfg)
        teardown = () => {
          for (const dispose of next) {
            try { dispose() } catch (error) { /* double dispose is harmless */ }
          }
        }
      }

      /** Settings → 品牌 Branding: edit every field, save applies instantly. */
      function BrandSection() {
        const [form, setForm] = React.useState(null)
        const [status, setStatus] = React.useState('')
        React.useEffect(() => {
          let alive = true
          fetch(API)
            .then((res) => res.json())
            .then((cfg) => { if (alive) setForm(clean(cfg)) })
            .catch(() => { if (alive) setForm(blank()) })
          return () => { alive = false }
        }, [])
        if (form === null) return h('div', { className: 'dsh-brand-form' }, '加载中…')
        const field = (key, label, placeholder) => h('div', { className: 'dsh-brand-field' },
          h('label', { className: 'dsh-brand-field-label' }, label),
          h('input', {
            className: 'dsh-brand-field-input',
            value: form[key],
            placeholder,
            onChange: (ev) => {
              const nextForm = {}
              for (const key2 of Object.keys(form)) nextForm[key2] = form[key2]
              nextForm[key] = ev !== null && typeof ev === 'object' && ev.target ? String(ev.target.value) : ''
              setForm(nextForm)
              setStatus('')
            },
          }))
        const write = (cfg, pending, done) => {
          // Auto-convert raw SVG markup to data URLs before saving.
          const payload = {}
          for (const key of Object.keys(cfg)) {
            payload[key] = (key === 'logoUrl' || key === 'favicon') ? ensureDataUrl(cfg[key]) : cfg[key]
          }
          setStatus(pending)
          fetch(API, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then((res) => {
              if (!res.ok) throw new Error('HTTP ' + res.status)
              return res.json()
            })
            .then((saved) => {
              applyConfig(clean(saved))
              setStatus(done)
            })
            .catch((error) => { setStatus('操作失败：' + String(error)) })
        }
        return h('div', { className: 'dsh-brand-form' },
          h('div', { className: 'dsh-brand-hint' },
            '一键替换界面品牌信息，配置保存在 $DSH_HOME/dsh-brand.json，可直接分发给二改部署。Hero 三项（主标题 / 徽标 / 简介）任一填写即接管新会话页头部；全部留空显示官方默认。favicon 替换浏览器标签页图标；勾选「隐藏内测声明」可屏蔽 DSH 启动弹窗。'),
          field('name', '产品名称（侧栏）', '如：Acme Harness'),
          field('version', '版本徽标（侧栏名称旁）', '如：v1.0.0'),
          field('headline', 'Hero 主标题', '如：探索未至之境'),
          field('badge', 'Hero 徽标', '如：预览版'),
          field('intro', '一句话简介（Hero 副标题）', '如：面向内部的智能体工作台'),
          field('logoText', '文字 / Emoji 商标（无图片时使用）', '如：🐳 或 A'),
          field('logoUrl', '商标图片 URL 或 Data URL（优先于文字商标）', '如：https://… 或 data:image/png;base64,…'),
          field('favicon', '浏览器标签页图标 URL 或 Data URL', '如：https://…/favicon.svg 或 data:image/svg+xml,…'),
          field('title', '浏览器标签页标题', '如：Acme Harness'),
          h('div', { className: 'dsh-brand-field dsh-brand-field-row' },
            h('label', { className: 'dsh-brand-field-label' }, '隐藏 DSH 内测声明弹窗'),
            h('input', {
              type: 'checkbox',
              className: 'dsh-brand-checkbox',
              checked: form.hideNotice === 'true',
              onChange: (ev) => {
                const nextForm = {}
                for (const key2 of Object.keys(form)) nextForm[key2] = form[key2]
                nextForm.hideNotice = ev !== null && typeof ev === 'object' && ev.target && ev.target.checked ? 'true' : ''
                setForm(nextForm)
                setStatus('')
              },
            })),
          h('div', { className: 'dsh-brand-actions' },
            h('button', {
              type: 'button',
              className: 'dsh-brand-btn dsh-brand-btn-primary',
              onClick: () => write(form, '保存中…', '已保存并应用 ✔'),
            }, '保存并应用'),
            h('button', {
              type: 'button',
              className: 'dsh-brand-btn dsh-brand-btn-plain',
              onClick: () => { const empty = blank(); setForm(empty); write(empty, '恢复中…', '已恢复官方默认 ✔') },
            }, '恢复默认'),
            status !== '' ? h('span', { className: 'dsh-brand-status' }, status) : null))
      }

      disposers.push(slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'brand', order: 90, label: '品牌 Branding' },
        BrandSection,
      )))

      // Boot synchronously from the config the host stamped into the HTML —
      // branding must be in place before first paint, not after a fetch.
      let appliedJson = ''
      const boot = typeof window === 'object' && window !== null ? window.__DSH_BRAND__ : undefined
      if (boot !== null && typeof boot === 'object') {
        const cfg = clean(boot)
        appliedJson = JSON.stringify(cfg)
        applyConfig(cfg)
      }

      // Then reconcile with the live file (covers saves made after this HTML
      // was served); a same-value response is a no-op.
      fetch(API)
        .then((res) => res.json())
        .then((raw) => {
          const cfg = clean(raw)
          const json = JSON.stringify(cfg)
          if (json !== appliedJson) {
            appliedJson = json
            applyConfig(cfg)
          }
        })
        .catch(() => { /* the boot-stamped config (or stock branding) stays */ })

      return () => {
        if (teardown !== null) { teardown(); teardown = null }
        if (styleEl !== null) { styleEl.remove(); styleEl = null }
        for (const dispose of disposers) {
          try { dispose() } catch (error) { /* double dispose is harmless */ }
        }
      }
    }

    return { name: 'dsh-brand', inject: ['slots'], apply }
  },
})
