import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallResult = 'ok' | 'ios' | 'unavailable' | 'installed'

type Listener = (event: BeforeInstallPromptEvent | null) => void

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<Listener>()
let captureBound = false

/** Marca local: o app foi instalado neste aparelho (vale também quando o site é aberto numa aba comum). */
const INSTALADO_KEY = 'costureirapro_app_instalado'

function marcarInstalado(valor: boolean) {
  try {
    if (valor) localStorage.setItem(INSTALADO_KEY, '1')
    else localStorage.removeItem(INSTALADO_KEY)
  } catch {
    /* sem armazenamento local: segue só com a detecção do navegador */
  }
}

function marcadoComoInstalado(): boolean {
  try {
    return localStorage.getItem(INSTALADO_KEY) === '1'
  } catch {
    return false
  }
}

/** Chrome/Edge: pergunta ao navegador se este app web já está instalado (manifest related_applications). */
async function navegadorDizInstalado(): Promise<boolean> {
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }
  if (typeof nav.getInstalledRelatedApps !== 'function') return false
  try {
    const apps = await nav.getInstalledRelatedApps()
    return apps.length > 0
  } catch {
    return false
  }
}

function notify(event: BeforeInstallPromptEvent | null) {
  listeners.forEach((listener) => listener(event))
}

/** Captura a oferta nativa o mais cedo possível — o evento costuma chegar antes do React montar. */
export function bindInstallCapture() {
  if (captureBound || typeof window === 'undefined') return
  captureBound = true

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    // O navegador só oferece instalar quando o app NÃO está instalado (ex.: foi desinstalado).
    marcarInstalado(false)
    notify(deferredPrompt)
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    marcarInstalado(true)
    notify(null)
  })
}

bindInstallCapture()

export function getDeferredInstallPrompt() {
  return deferredPrompt
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

async function waitForDeferred(ms: number): Promise<BeforeInstallPromptEvent | null> {
  if (deferredPrompt) return deferredPrompt
  return new Promise((resolve) => {
    let done = false
    const finish = (event: BeforeInstallPromptEvent | null) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      listeners.delete(onChange)
      resolve(event)
    }
    const onChange: Listener = (event) => {
      if (event) finish(event)
    }
    listeners.add(onChange)
    const timer = window.setTimeout(() => finish(deferredPrompt), ms)
  })
}

export function useInstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(() => deferredPrompt)

  useEffect(() => {
    bindInstallCapture()
    setDeferred(deferredPrompt)
    const onChange: Listener = (event) => setDeferred(event)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  async function install(): Promise<InstallResult> {
    if (isStandaloneApp()) return 'installed'

    let event = deferredPrompt || deferred
    if (!event) {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready
        } catch {
          /* segue tentando a oferta */
        }
      }
      event = await waitForDeferred(2000)
    }

    if (event) {
      await event.prompt()
      try {
        const choice = await event.userChoice
        if (choice?.outcome === 'accepted') marcarInstalado(true)
      } catch {
        /* alguns navegadores não expõem userChoice */
      }
      deferredPrompt = null
      notify(null)
      setDeferred(null)
      return 'ok'
    }

    // Sem oferta do navegador: pode ser porque o app já está instalado (site aberto numa aba comum).
    if (marcadoComoInstalado() || (await navegadorDizInstalado())) {
      marcarInstalado(true)
      return 'installed'
    }

    if (isIosDevice()) return 'ios'
    return 'unavailable'
  }

  return { canPrompt: Boolean(deferred || deferredPrompt), install }
}
