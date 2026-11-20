<template>
  <div class="scanner">
    <div class="viewport" :class="{ hit: !!detected, off: error }">
      <video ref="video" playsinline muted autoplay></video>
      <div v-if="!error" class="frame" aria-hidden="true">
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
        <span class="laser"></span>
      </div>
      <div v-if="error" class="nocam">
        <vue-feather type="video-off" size="24" />
        <strong>{{ $t('scan.noCamera') }}</strong>
        <span class="muted">{{ $t('scan.noCameraText') }}</span>
      </div>
      <div v-if="detected" class="detected">
        <vue-feather type="check-circle" size="28" />
        <span class="mono">{{ detected }}</span>
      </div>
      <div v-if="!error && !detected" class="hud">
        <span>{{ $t('scan.hint') }}</span>
        <button v-if="torch" class="icon-btn sm" :class="{ active: torchOn }" :aria-label="$t('scan.torch')" @click="toggleTorch">
          <vue-feather type="zap" size="15" />
        </button>
      </div>
    </div>

    <form class="manual" @submit.prevent="submitManual">
      <div class="input-wrap grow">
        <span class="lead"><vue-feather type="hash" size="16" /></span>
        <input v-model="manual" class="input" inputmode="numeric" :placeholder="$t('scan.manualPlaceholder')" :aria-label="$t('scan.manual')" />
      </div>
      <button class="btn" :disabled="manual.replace(/\D/g, '').length < 8">{{ $t('scan.lookup') }}</button>
    </form>
  </div>
</template>

<script>
import { vibrate } from '../lib/sparkle.js'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/** GTIN checksum (EAN-8, UPC-A, EAN-13). */
export function validGtin(code) {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

export default {
  name: 'BarcodeScanner',
  emits: ['detected'],
  data: () => ({ error: false, detected: null, manual: '', torch: false, torchOn: false }),
  mounted() { this.start() },
  beforeUnmount() { this.stop() },
  methods: {
    async start() {
      this.detected = null
      this.last = null
      if (!navigator.mediaDevices?.getUserMedia) { this.error = true; return }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      } catch {
        this.error = true
        return
      }
      if (!this.$refs.video) return this.stop()
      const video = this.$refs.video
      video.srcObject = this.stream
      await video.play().catch(() => {})

      this.track = this.stream.getVideoTracks()[0]
      const caps = this.track.getCapabilities?.() || {}
      this.torch = !!caps.torch
      if (caps.focusMode?.includes('continuous')) this.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})

      if ('BarcodeDetector' in window) {
        const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => [])
        const formats = FORMATS.filter((f) => supported.includes(f))
        if (formats.length) return this.loopNative(new window.BarcodeDetector({ formats }))
      }
      this.startZxing()
    },

    loopNative(detector) {
      const tick = async () => {
        if (!this.stream || this.detected) return
        try {
          const video = this.$refs.video
          if (video?.readyState >= 2) {
            const codes = await detector.detect(video)
            if (codes[0]) this.hit(codes[0].rawValue)
          }
        } catch {}
        this.timer = setTimeout(tick, 120)
      }
      tick()
    },

    async startZxing() {
      const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ])
      const hints = new Map([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
        [DecodeHintType.TRY_HARDER, true],
      ])
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 })
      if (!this.stream) return
      this.controls = await reader.decodeFromVideoElement(this.$refs.video, (result) => {
        if (result) this.hit(result.getText())
      })
    },

    hit(raw) {
      const code = String(raw).replace(/\D/g, '')
      if (this.detected || !validGtin(code)) return
      // Two identical consecutive reads: cheap protection against misreads.
      if (this.last !== code) { this.last = code; return }
      this.detected = code
      vibrate([20, 30, 40])
      this.stop(false)
      setTimeout(() => this.$emit('detected', code), 450)
    },

    submitManual() {
      const code = this.manual.replace(/[^0-9X]/gi, '')
      if (code.length < 8) return
      this.detected = code
      this.stop(false)
      this.$emit('detected', code)
    },

    async toggleTorch() {
      this.torchOn = !this.torchOn
      await this.track?.applyConstraints({ advanced: [{ torch: this.torchOn }] }).catch(() => { this.torchOn = false })
    },

    stop() {
      clearTimeout(this.timer)
      this.controls?.stop()
      this.controls = null
      this.stream?.getTracks().forEach((t) => t.stop())
      this.stream = null
    },
  },
}
</script>

<style scoped>
.scanner { display: flex; flex-direction: column; gap: 10px; }
.viewport {
  position: relative; aspect-ratio: 16 / 10; border-radius: var(--r-lg); overflow: hidden; background: #0a0a0b;
  box-shadow: var(--shadow), 0 0 0 1px var(--border-strong); transition: box-shadow 0.4s;
}
.viewport.hit { box-shadow: 0 0 0 2px var(--accent), 0 0 40px -10px var(--accent-glow); }
@media (max-width: 600px) { .viewport { aspect-ratio: 4 / 4.4; } }
video { width: 100%; height: 100%; object-fit: cover; }
.off video { display: none; }
.frame { position: absolute; inset: 22% 10%; }
@media (max-width: 600px) { .frame { inset: 30% 8%; } }
.corner { position: absolute; width: 22px; height: 22px; border: 2.5px solid #fff; filter: drop-shadow(0 0 6px var(--accent-glow)); }
.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-radius: var(--r) 0 0 0; }
.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-radius: 0 var(--r) 0 0; }
.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 var(--r); }
.br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-radius: 0 0 var(--r) 0; }
.laser {
  position: absolute; left: 6%; right: 6%; top: 50%; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), #fff, var(--accent), transparent);
  box-shadow: 0 0 16px 3px var(--accent-glow); animation: laser 2.2s ease-in-out infinite;
}
@keyframes laser { 0%, 100% { transform: translateY(-40px); opacity: 0.6; } 50% { transform: translateY(40px); opacity: 1; } }
.hud {
  position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  color: #fff; font-size: 13px; font-weight: 600; text-shadow: 0 1px 6px #000;
}
.hud .icon-btn { color: #fff; background: rgb(0 0 0 / 0.4); border-color: rgb(255 255 255 / 0.2); }
.detected {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: color-mix(in oklab, var(--accent-glow) 35%, rgb(10 10 12 / 0.6)); color: #fff; font-size: 15px; font-weight: 700;
  animation: flash 0.5s var(--ease);
}
.detected :deep(svg) { animation: pop 0.5s var(--spring); }
@keyframes flash { from { background: rgb(255 255 255 / 0.9); } }
@keyframes pop { from { transform: scale(0); } }
.nocam { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 24px; text-align: center; color: #fff; }
.nocam .muted { color: #a0a0a8; font-size: 12.5px; max-width: 300px; }
.manual { display: flex; gap: 8px; }
</style>
