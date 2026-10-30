// The progress bar over the bottom of the photos: a step label, a "3 / 12" count and a
// bar. start() opens it (data-open: it slides up and fades in), finish() turns
// it green (data-finished) and closes it after a moment, fail() turns it
// red and keeps it open. Closed, it is inert, so nothing in it is focusable.

const VISIBLE_AFTER_FINISH = 2200

export interface Progress {
  start(label: string, total: number): void
  step(done: number, total: number, label?: string): void
  /** For steps measured in percent (packing the ZIP). */
  percent(fraction: number, label?: string): void
  finish(label: string, count: string): void
  fail(label: string): void
  /** Keeps a finished bar on screen while a step still waits for the user. */
  hold(): void
}

export function createProgress(element: HTMLElement): Progress {
  const label = element.querySelector<HTMLElement>("[data-progress-label]")!
  const count = element.querySelector<HTMLElement>("[data-progress-count]")!
  const bar = element.querySelector<HTMLElement>("[role=progressbar]")!
  const fill = element.querySelector<HTMLElement>("[data-progress-fill]")!
  let timers: ReturnType<typeof setTimeout>[] = []

  function set(fraction: number, text: string | undefined, countText: string) {
    if (text) label.textContent = text
    count.textContent = countText
    fill.style.transform = `scaleX(${fraction})`
    bar.setAttribute("aria-valuenow", String(Math.round(fraction * 100)))
  }

  return {
    start(text, total) {
      timers.forEach(clearTimeout)
      timers = []
      delete element.dataset.finished
      delete element.dataset.failed
      // Back to empty at once: animated, the bar would run backwards from the
      // last job's 100 % while the panel opens.
      fill.style.transition = "none"
      set(0, text, `0 / ${total}`)
      void fill.offsetWidth
      fill.style.transition = ""
      element.dataset.open = ""
      element.inert = false
    },
    step(done, total, text) {
      set(total ? done / total : 1, text, `${done} / ${total}`)
    },
    percent(fraction, text) {
      set(fraction, text, `${Math.round(fraction * 100)}%`)
    },
    finish(text, countText) {
      set(1, text, countText)
      element.dataset.finished = ""
      timers.push(
        setTimeout(() => {
          delete element.dataset.open
          element.inert = true
        }, VISIBLE_AFTER_FINISH),
      )
    },
    fail(text) {
      label.textContent = text
      element.dataset.failed = ""
    },
    hold() {
      timers.forEach(clearTimeout)
      timers = []
    },
  }
}
