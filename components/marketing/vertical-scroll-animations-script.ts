/** Scroll + load animations for industry vertical landing pages (shared across all 5 verticals). */
export const verticalScrollAnimationsScript = `
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!('IntersectionObserver' in window)) return

  const THRESHOLD = 0.15
  const style = document.createElement('style')
  style.textContent = [
    '@keyframes v-anim-phone-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
    '.v-anim-phone-float{animation:v-anim-phone-float 5s ease-in-out infinite;will-change:transform}',
    '.v-anim-pain-pre{opacity:0;transform:translateY(24px);transition:opacity 550ms ease-out,transform 550ms ease-out}',
    '.v-anim-pain-in{opacity:1;transform:translateY(0)}',
    '.v-anim-feat-pre{opacity:0;transform:translateY(20px);transition:opacity 450ms ease-out,transform 450ms ease-out}',
    '.v-anim-feat-in{opacity:1;transform:translateY(0)}',
    '.v-anim-step-pre{opacity:0;transform:translateX(-16px);transition:opacity 500ms ease-out,transform 500ms ease-out}',
    '.v-anim-step-in{opacity:1;transform:translateX(0)}',
    '.v-anim-vs-pre{opacity:0;transition:opacity 400ms ease-out}',
    '.v-anim-vs-in{opacity:1}',
    '.v-anim-hub-pre{opacity:0;transform:translateY(16px);transition:opacity 400ms ease-out,transform 400ms ease-out}',
    '.v-anim-hub-in{opacity:1;transform:translateY(0)}',
    '@media(min-width:768px){',
    '.v-anim-step-conn{display:block;position:absolute;top:42px;left:calc(50% + 18px);width:calc(50% + 20px);height:2px;background:#d1d5db;transform-origin:left center;transform:scaleX(0);transition:transform 500ms ease-out;pointer-events:none;z-index:0}',
    '.v-anim-step-conn.is-drawn{transform:scaleX(1)}',
    '}',
  ].join('')
  document.head.appendChild(style)

  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

  const observeOnce = (target, onEnter) => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        observer.unobserve(entry.target)
        onEnter(entry.target)
      })
    }, { threshold: THRESHOLD })
    observer.observe(target)
  }

  const animateCounter = (el, delay) => {
    const target = Number.parseInt(el.getAttribute('data-count') || '0', 10)
    const suffix = el.getAttribute('data-suffix') || ''
    const duration = 1200
    window.setTimeout(() => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        const value = Math.round(easeOutExpo(t) * target)
        el.textContent = String(value) + suffix
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
  }

  const staggerReveal = (items, inClass, delayFn) => {
    items.forEach((item, index) => {
      window.setTimeout(() => item.classList.add(inClass), delayFn(index))
    })
  }

  const phone = document.querySelector('[data-vertical-phone-float] .cp-frame')
  if (phone) phone.classList.add('v-anim-phone-float')

  const statStrip = document.querySelector('[data-vertical-stat-strip]')
  if (statStrip) {
    const values = Array.from(statStrip.querySelectorAll('.vertical-stat-strip__value[data-count]'))
    values.forEach((el) => {
      const suffix = el.getAttribute('data-suffix') || ''
      el.textContent = '0' + suffix
    })
    observeOnce(statStrip, () => {
      values.forEach((el, index) => animateCounter(el, index * 120))
    })
  }

  const painGrid = document.querySelector('[data-vertical-pain-grid]')
  if (painGrid) {
    const cards = Array.from(painGrid.querySelectorAll('[data-vertical-pain-card]'))
    cards.forEach((card) => card.classList.add('v-anim-pain-pre'))
    observeOnce(painGrid, () => {
      staggerReveal(cards, 'v-anim-pain-in', (i) => i * 150)
    })
  }

  const featureGrid = document.querySelector('[data-vertical-feature-grid]')
  if (featureGrid) {
    const cards = Array.from(featureGrid.querySelectorAll('[data-vertical-feature-card]'))
    cards.forEach((card) => card.classList.add('v-anim-feat-pre'))
    observeOnce(featureGrid, () => {
      staggerReveal(cards, 'v-anim-feat-in', (i) => i * 100)
    })
  }

  document.querySelectorAll('[data-vertical-how-section]').forEach((section) => {
    const scroller = section.querySelector('[data-vertical-step-scroller]')
    if (!scroller) return
    const cards = Array.from(scroller.querySelectorAll('[data-vertical-step-card]'))
    const connectors = []
    if (window.matchMedia('(min-width: 768px)').matches) {
      cards.forEach((card, index) => {
        if (index >= cards.length - 1) return
        const conn = document.createElement('span')
        conn.className = 'v-anim-step-conn'
        conn.setAttribute('data-vertical-step-connector', String(index))
        conn.setAttribute('aria-hidden', 'true')
        card.appendChild(conn)
        connectors.push(conn)
      })
    }
    cards.forEach((card) => card.classList.add('v-anim-step-pre'))
    observeOnce(section, () => {
      cards.forEach((card, index) => {
        const delay = index * 250
        window.setTimeout(() => card.classList.add('v-anim-step-in'), delay)
        if (connectors[index]) {
          window.setTimeout(() => connectors[index].classList.add('is-drawn'), delay + 500)
        }
      })
    })
  })

  document.querySelectorAll('[data-vertical-vs-table]').forEach((table) => {
    const header = table.querySelector('[data-vertical-vs-header]')
    const rows = Array.from(table.querySelectorAll('[data-vertical-vs-row]'))
    if (header) header.classList.add('v-anim-vs-pre')
    rows.forEach((row) => row.classList.add('v-anim-vs-pre'))
    observeOnce(table, () => {
      if (header) header.classList.add('v-anim-vs-in')
      rows.forEach((row, index) => {
        window.setTimeout(() => row.classList.add('v-anim-vs-in'), (index + 1) * 120)
      })
    })
  })

  document.querySelectorAll('[data-vertical-hub-section]').forEach((section) => {
    const cards = Array.from(section.querySelectorAll('[data-vertical-hub-card]'))
    if (!cards.length) return
    cards.forEach((card) => card.classList.add('v-anim-hub-pre'))
    observeOnce(section, () => {
      staggerReveal(cards, 'v-anim-hub-in', (i) => Math.min(i, 8) * 80)
    })
  })
})()
`;
