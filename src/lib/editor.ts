// The editor in the browser: picked photos, the options, previews and
// export. Each photo keeps a small preview canvas for fast re-rendering;
// the full-size image is decoded again only on export, so a big album
// does not hold every full-resolution photo in memory.

import type { EditorStrings } from "../i18n"
import { track } from "./analytics"
import { buildExif, exifSegment, fitExif, insertExif } from "./exif"
import { droppedPhotos, uniqueName } from "./files"
import { createProgress } from "./progress"
import { decodePhoto, photoDate, stampedFileName, type DateSource } from "./photo"
import {
  DEFAULT_OPTIONS,
  SAFE_EXPORT_PIXELS,
  canvasToJpeg,
  fitPixels,
  formatDate,
  maxExportPixels,
  renderStamped,
  type DateFormat,
  type StampOptions,
} from "./stamp"

const PREVIEW_PIXELS = 600_000
const SETTINGS_KEY = "datestamp:options"

// What the photo's card shows (data-state, styled in global.css):
//   waiting → loading → ready   while the photos are being added,
//   queued → working → done     while an export runs. "done" means the
//   photo is in the last download; changing its date or the options puts
//   it back to "ready", because that file no longer matches.
type PhotoState = "waiting" | "loading" | "ready" | "queued" | "working" | "done"

interface Photo {
  id: number
  file: File
  date: Date
  source: DateSource
  preview?: HTMLCanvasElement
  element: HTMLElement
  /** The user changed the date under the thumbnail: it goes into the EXIF too. */
  dateEdited?: boolean
}

export function mountEditor(root: HTMLElement) {
  const strings: EditorStrings = JSON.parse(root.dataset.strings!)
  const input = root.querySelector<HTMLInputElement>("[data-input]")!
  const dropzone = root.querySelector<HTMLElement>("[data-dropzone]")!
  const list = root.querySelector<HTMLElement>("[data-photos]")!
  const addMoreButton = root.querySelector<HTMLButtonElement>("[data-add-more]")!
  const saveAllButton = root.querySelector<HTMLButtonElement>("[data-save-all]")!
  const zipButton = root.querySelector<HTMLButtonElement>("[data-zip]")!
  const clearButton = root.querySelector<HTMLButtonElement>("[data-clear]")!
  const saveNowButton = root.querySelector<HTMLButtonElement>("[data-save-now]")!
  const saveHint = root.querySelector<HTMLElement>("[data-save-hint]")!
  const controls = root.querySelector<HTMLFieldSetElement>("[data-options]")!
  const formatSelect = controls.querySelector<HTMLElement & { value: string }>("el-select[name=format]")!
  const sizeInput = controls.querySelector<HTMLInputElement>("input[name=size]")!
  const progress = createProgress(root.querySelector<HTMLElement>("[data-progress]")!)
  const sample = new Date(root.dataset.sample!)

  let photos: Photo[] = []
  let nextId = 1
  let saving = false
  // The default format is the page's language's own (its first in the list).
  const defaults = { ...DEFAULT_OPTIONS, format: (root.dataset.defaultFormat ?? DEFAULT_OPTIONS.format) as DateFormat }
  let options: StampOptions = { ...defaults, ...loadOptions() }
  // A format remembered on a page in another language may not be offered here.
  // (From the server, not from <el-select>'s options: Elements may have moved those by now.)
  const offered: string[] = JSON.parse(root.dataset.formats ?? "[]")
  if (!offered.includes(options.format)) options.format = defaults.format
  const mode = saveMode()
  saveAllButton.textContent = { folder: strings.saveToFolder, gallery: strings.saveToGallery, files: strings.downloadAll }[mode]

  // The controls: radio tiles for the style and the position, <el-select>
  // for the format, a slider for the size. Show the remembered options...
  const radio = (name: string, value: string) => controls.querySelector<HTMLInputElement>(`input[name=${name}][value="${value}"]`)
  ;(radio("style", options.style) ?? radio("style", DEFAULT_OPTIONS.style))!.checked = true
  ;(radio("position", options.position) ?? radio("position", DEFAULT_OPTIONS.position))!.checked = true
  // The attribute too: <el-select> reads its value attribute when it
  // starts, which would undo a property set before that.
  formatSelect.setAttribute("value", options.format)
  formatSelect.value = options.format
  // <el-select> may have started already (Elements loads in the layout), and
  // it then does not redraw its button for a value set from code.
  const shown = formatSelect.querySelector("el-selectedcontent")
  if (shown) shown.textContent = formatDate(sample, options.format)
  sizeInput.value = String(options.size)
  refreshPreviews()

  // ...and follow every change. The radios bubble change up to the
  // fieldset; the slider fires input while dragging; <el-select> fires its own.
  const update = (patch: Partial<StampOptions>) => {
    const next = { ...options, ...patch }
    if (JSON.stringify(next) === JSON.stringify(options)) return
    options = next
    saveOptions(options)
    refreshPreviews()
    photos.forEach((photo) => {
      drawPreview(photo)
      if (stateOf(photo) === "done") setState(photo, "ready")
    })
    refreshActions()
  }
  controls.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement
    if (target.type === "radio" && target.checked) update({ [target.name]: target.value })
  })
  sizeInput.addEventListener("input", () => update({ size: Number(sizeInput.value) }))
  for (const type of ["input", "change"]) formatSelect.addEventListener(type, () => update({ format: formatSelect.value as DateFormat }))

  /** The sample dates in the tiles and the position picker follow the options. */
  function refreshPreviews() {
    const text = formatDate(sample, options.format)
    root.querySelectorAll<HTMLElement>("[data-stamp-sample]").forEach((stamp) => (stamp.textContent = text))
    // The position picker shows the date as it will look: this style, this size.
    root.querySelectorAll<HTMLElement>("[data-stamp-live]").forEach((stamp) => {
      stamp.dataset.style = options.style
      stamp.style.fontSize = `${Math.round(8 + options.size * 0.9)}px`
    })
    root.querySelector("[data-position-label]")!.textContent = strings.positions[options.position]
    root.querySelector("[data-size-label]")!.textContent =
      options.size <= 3 ? strings.sizes.small : options.size <= 6 ? strings.sizes.medium : strings.sizes.large
  }

  // Adding and exporting run one at a time (they share the progress bar):
  // photos dropped during an export are added once it has finished.
  let queue: Promise<unknown> = Promise.resolve()
  const run = (job: () => Promise<void>): Promise<void> => {
    const result = queue.then(job).catch((error) => {
      console.error(error)
      progress.fail(strings.progressFailed)
      track("editor_error")
      photos.forEach((photo) => {
        if (stateOf(photo) === "queued" || stateOf(photo) === "working") setState(photo, "ready")
      })
    })
    queue = result
    return result
  }

  input.addEventListener("change", () => {
    if (input.files) addFiles([...input.files])
    input.value = ""
  })
  dropzone.addEventListener("click", () => input.click())
  addMoreButton.addEventListener("click", () => input.click())

  // The whole page takes dropped photos, not only the zone: a photo dropped
  // beside it would otherwise be opened by the browser, leaving the page.
  // dragenter/dragleave fire for every child element, so a counter tells
  // when the drag has really left the window.
  let dragDepth = 0
  const draggingFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false
  document.addEventListener("dragenter", (event) => {
    if (!draggingFiles(event)) return
    dragDepth++
    dropzone.dataset.dragging = ""
  })
  document.addEventListener("dragleave", (event) => {
    if (!draggingFiles(event)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) delete dropzone.dataset.dragging
  })
  document.addEventListener("dragover", (event) => {
    if (!draggingFiles(event)) return
    event.preventDefault()
    event.dataTransfer!.dropEffect = "copy"
  })
  document.addEventListener("drop", (event) => {
    if (!draggingFiles(event)) return
    event.preventDefault()
    dragDepth = 0
    delete dropzone.dataset.dragging
    addFiles(droppedPhotos(event.dataTransfer!))
  })

  saveAllButton.addEventListener("click", () => busy(saveAllButton, saveAll))
  zipButton.addEventListener("click", () => busy(zipButton, downloadZip))
  clearButton.addEventListener("click", () => {
    photos = []
    list.replaceChildren()
    refreshActions()
  })

  function addFiles(files: File[]) {
    if (!files.length) return
    // Every photo gets its card at once, as a placeholder, so the user sees
    // how many are coming; then they load one by one.
    const added = files.map((file) => {
      const photo: Photo = { id: nextId++, file, date: new Date(file.lastModified), source: "file", element: photoElement({ file }) }
      setState(photo, "waiting")
      list.append(photo.element)
      return photo
    })
    photos.push(...added)
    refreshActions()

    return run(async () => {
      progress.start(strings.progressLoading, added.length)
      let loaded = 0
      for (const photo of added) {
        if (!photos.includes(photo)) continue // removed while waiting
        setState(photo, "loading")
        try {
          await loadPhoto(photo)
          setState(photo, "ready")
        } catch {
          showError(photo)
        }
        progress.step(++loaded, added.length)
      }
      progress.finish(strings.progressDone, `${loaded} / ${added.length}`)
      refreshActions()
      // Counts only: never a file name or a date from a photo.
      const withExif = added.filter((photo) => photo.source === "exif").length
      track("photos_add", { count: added.length, with_exif: withExif })
    })
  }

  async function loadPhoto(photo: Photo) {
    const [{ date, source }, full] = await Promise.all([photoDate(photo.file), decodePhoto(photo.file)])
    const size = fitPixels(full.width, full.height, PREVIEW_PIXELS)
    // A canvas, not createImageBitmap's resize options: Safari ignores those.
    const preview = document.createElement("canvas")
    preview.width = size.width
    preview.height = size.height
    preview.getContext("2d")!.drawImage(full, 0, 0, size.width, size.height)
    full.close()
    Object.assign(photo, { date, source, preview })
    fillPhotoElement(photo)
    drawPreview(photo)
  }

  function showError(photo: Photo) {
    photos = photos.filter((p) => p !== photo)
    const error = document.createElement("p")
    error.className = "m-0 self-center text-sm text-red-500"
    error.textContent = strings.cannotOpen.replace("{name}", photo.file.name)
    photo.element.replaceWith(error)
  }

  // The card's frame (the preview, the state badge, the remove button)
  // exists from the start; the date and its source are filled in once the
  // photo has loaded.
  function photoElement(photo: Pick<Photo, "file">) {
    const element = document.createElement("figure")
    element.className = "photo m-0 flex min-w-0 flex-col gap-1.5"
    element.innerHTML = `
      <div class="photo-frame relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-lg bg-photo transition-[box-shadow,opacity,filter] duration-250">
        <canvas class="block max-h-full max-w-full"></canvas>
        <span class="photo-badge absolute top-1.5 left-1.5 flex h-6 items-center gap-1.5 rounded-full bg-black/75 pr-2.5 pl-1.5 text-xs font-semibold text-white">
          <span class="photo-badge-icon block size-3.5 rounded-full" aria-hidden="true"></span><span class="photo-badge-text"></span>
        </span>
        <button type="button" class="absolute top-1.5 right-1.5 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition after:absolute after:-inset-1.5 hover:bg-black/80" data-remove>
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
        </button>
      </div>
      <figcaption class="flex min-w-0 items-baseline justify-between gap-2 text-xs text-muted">
        <span class="truncate font-mono" data-name></span>
        <span class="flex-none" data-source></span>
      </figcaption>
      <details class="photo-date text-xs" hidden>
        <summary class="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-muted hover:text-ink">
          <svg class="size-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          <span class="truncate font-mono" data-date-label></span>
        </summary>
        <input type="datetime-local" step="60" class="mt-1 w-full rounded-md border border-line bg-page px-2 py-1.5 text-sm text-ink" />
      </details>`
    element.querySelector("[data-name]")!.textContent = photo.file.name
    const remove = element.querySelector<HTMLButtonElement>("[data-remove]")!
    remove.setAttribute("aria-label", `${strings.remove}: ${photo.file.name}`)
    remove.addEventListener("click", () => {
      photos = photos.filter((p) => p.element !== element)
      element.remove()
      refreshActions()
    })
    return element
  }

  function fillPhotoElement(photo: Photo) {
    const { element } = photo
    const source = element.querySelector<HTMLElement>("[data-source]")!
    source.textContent = photo.source === "exif" ? "EXIF" : strings.sourceFile
    source.className = photo.source === "exif" ? "flex-none font-mono" : "flex-none font-semibold text-accent"

    // The date is changed under the thumbnail, folded away until needed.
    const details = element.querySelector<HTMLDetailsElement>(".photo-date")!
    const dateInput = details.querySelector("input")!
    details.hidden = false
    const summary = details.querySelector("summary")!
    summary.title = strings.changeDate
    summary.setAttribute("aria-label", strings.changeDate)
    dateInput.value = toLocalInputValue(photo.date)
    dateInput.addEventListener("input", () => {
      const picked = new Date(dateInput.value)
      if (Number.isNaN(picked.getTime())) return
      photo.date = picked
      photo.dateEdited = true
      drawPreview(photo)
      if (stateOf(photo) === "done") setState(photo, "ready")
    })
  }

  function stateOf(photo: Photo) {
    return photo.element.dataset.state as PhotoState
  }

  function setState(photo: Photo, state: PhotoState) {
    photo.element.dataset.state = state
    const text: Record<PhotoState, string> = {
      waiting: strings.stateQueued,
      loading: strings.stateWorking,
      ready: "",
      queued: strings.stateQueued,
      working: strings.stateWorking,
      done: strings.stateDone,
    }
    photo.element.querySelector(".photo-badge-text")!.textContent = text[state]
    photo.element.setAttribute("aria-busy", String(state === "loading" || state === "working"))
  }

  function drawPreview(photo: Photo) {
    const { preview } = photo
    if (!preview) return
    const stamped = renderStamped(preview, preview, formatDate(photo.date, options.format), options)
    const label = photo.element.querySelector("[data-date-label]")
    if (label) label.textContent = formatDate(photo.date, options.format)
    const canvas = photo.element.querySelector("canvas")!
    canvas.width = stamped.width
    canvas.height = stamped.height
    canvas.getContext("2d")!.drawImage(stamped, 0, 0)
  }

  async function exportPhoto(photo: Photo): Promise<Blob> {
    const full = await decodePhoto(photo.file)
    let jpeg: Blob
    let size = fitPixels(full.width, full.height, maxExportPixels())
    try {
      const text = formatDate(photo.date, options.format)
      try {
        jpeg = await canvasToJpeg(renderStamped(full, size, text, options))
      } catch {
        // The browser could not hold the canvas at this size (memory, its own
        // limit): a smaller photo beats none.
        size = fitPixels(full.width, full.height, SAFE_EXPORT_PIXELS)
        jpeg = await canvasToJpeg(renderStamped(full, size, text, options))
      }
    } finally {
      full.close()
    }
    return withMetadata(photo, jpeg, size)
  }

  /**
   * The exported JPEG with the photo's EXIF back in (src/lib/exif.ts): the
   * original's, fitted to the new file, or a minimal one with the date.
   */
  async function withMetadata(photo: Photo, jpeg: Blob, size: { width: number; height: number }): Promise<Blob> {
    const isJpeg = photo.file.type === "image/jpeg" || /\.jpe?g$/i.test(photo.file.name)
    const original = isJpeg ? exifSegment(new Uint8Array(await photo.file.arrayBuffer())) : null
    const segment = (original && fitExif(original, { ...size, date: photo.dateEdited ? photo.date : undefined })) ?? buildExif(photo.date)
    return new Blob([insertExif(new Uint8Array(await jpeg.arrayBuffer()), segment) as BlobPart], { type: "image/jpeg" })
  }

  /**
   * Every ready photo at full size, one after another, with the progress
   * bar and each card's state following along.
   */
  async function exportAll(): Promise<{ photo: Photo; blob: Blob }[]> {
    const batch = photos.filter((photo) => photo.preview)
    batch.forEach((photo) => setState(photo, "queued"))
    progress.start(strings.progressExporting, batch.length)
    const results = []
    for (const [index, photo] of batch.entries()) {
      setState(photo, "working")
      results.push({ photo, blob: await exportPhoto(photo) })
      setState(photo, "done")
      progress.step(index + 1, batch.length)
    }
    return results
  }

  // What was saved and how, for the statistics (counts and options only).
  const trackSave = (count: number, method: string) =>
    track("photos_save", { count, method, style: options.style, format: options.format, position: options.position, size: options.size })

  /**
   * "Save all" without a ZIP, because many people cannot open one:
   * - folder: Chrome/Edge on a computer let the user pick a folder, and the
   *   photos are written into it as plain files;
   * - gallery: on a phone the share sheet's "Save Images" puts them in the
   *   gallery (or sends them to a messenger);
   * - files: elsewhere every photo downloads as its own file.
   */
  async function saveAll() {
    if (mode === "folder") {
      // The picker needs the click's user activation, so it opens before the export.
      let folder: FileSystemDirectoryHandle
      try {
        folder = await window.showDirectoryPicker!({ id: "datestamp", mode: "readwrite", startIn: "pictures" })
      } catch {
        return // the user closed the picker
      }
      return run(async () => {
        const results = await exportAll()
        for (const { photo, blob } of results) await writeToFolder(folder, stampedFileName(photo.file.name), blob)
        progress.finish(strings.progressDone, `${results.length} / ${results.length}`)
        trackSave(results.length, "folder")
      })
    }

    if (mode === "gallery") {
      return run(async () => {
        const results = await exportAll()
        const files = results.map(({ photo, blob }) => new File([blob], stampedFileName(photo.file.name), { type: "image/jpeg" }))
        progress.finish(strings.progressDone, `${results.length} / ${results.length}`)
        trackSave(results.length, "gallery")
        await shareFiles(files)
      })
    }

    return run(async () => {
      const results = await exportAll()
      for (const { photo, blob } of results) {
        saveBlob(blob, stampedFileName(photo.file.name))
        // Browsers drop downloads started in the same instant.
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      progress.finish(strings.progressDone, `${results.length} / ${results.length}`)
      trackSave(results.length, "files")
    })
  }

  // The share sheet needs a recent tap, and a long export outlasts the one
  // that started it. Then the sheet is refused, and a "Save the photos"
  // button under the finished bar asks for a fresh tap.
  async function shareFiles(files: File[]) {
    try {
      await navigator.share({ files })
    } catch (error) {
      if ((error as DOMException).name !== "NotAllowedError") return // closed by the user
      progress.hold()
      saveNowButton.hidden = false
      saveNowButton.onclick = async () => {
        saveNowButton.hidden = true
        await navigator.share({ files }).catch(() => {})
        progress.finish(strings.progressDone, `${files.length} / ${files.length}`)
      }
    }
  }

  function downloadZip() {
    return run(async () => {
      const results = await exportAll()
      // Loaded only when needed, so the first page load stays small.
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      for (const { photo, blob } of results) zip.file(uniqueName((name) => zip.file(name) !== null, stampedFileName(photo.file.name)), blob)
      progress.percent(0, strings.progressZipping)
      // JPEGs are already compressed: STORE packs them as they are, much faster.
      const archive = await zip.generateAsync({ type: "blob", compression: "STORE" }, ({ percent }) => progress.percent(percent / 100))
      saveBlob(archive, "datestamp.zip")
      progress.finish(strings.progressDone, `${results.length} / ${results.length}`)
      trackSave(results.length, "zip")
    })
  }

  // Buttons and hints follow the photos and whether a job is running.
  function refreshActions() {
    const ready = photos.filter((photo) => photo.preview).length
    const any = photos.length > 0
    dropzone.hidden = any
    addMoreButton.hidden = !any
    saveAllButton.disabled = saving || ready === 0
    zipButton.hidden = photos.length < 2
    zipButton.disabled = saving
    clearButton.hidden = !any || saving
    controls.disabled = saving
    const done = photos.some((photo) => stateOf(photo) === "done")
    saveHint.textContent = saving ? strings.locked : !any ? strings.saveFirst : done ? strings.doneHint : ""
    saveHint.hidden = saveHint.textContent === ""
  }

  async function busy(button: HTMLButtonElement, work: () => Promise<unknown>) {
    const label = button.textContent
    saving = true
    refreshActions()
    button.innerHTML = `<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.3"></circle><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-linecap="round"></path></svg>`
    button.append(strings.saving)
    try {
      await work()
    } finally {
      saving = false
      button.textContent = label
      refreshActions()
    }
  }
}

type SaveMode = "folder" | "gallery" | "files"

function saveMode(): SaveMode {
  if (typeof window.showDirectoryPicker === "function") return "folder"
  const probe = new File([""], "probe.jpg", { type: "image/jpeg" })
  const canShareFiles = navigator.canShare?.({ files: [probe] }) ?? false
  // A touch device: desktop Safari can share files too, but there the
  // downloads folder is what people expect.
  if (canShareFiles && matchMedia("(pointer: coarse)").matches) return "gallery"
  return "files"
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<FileSystemDirectoryHandle>
  }
}

async function writeToFolder(folder: FileSystemDirectoryHandle, name: string, blob: Blob) {
  const existing = new Set<string>()
  for await (const key of (folder as unknown as { keys(): AsyncIterable<string> }).keys()) existing.add(key)
  const file = await folder.getFileHandle(uniqueName((candidate) => existing.has(candidate), name), { create: true })
  const writable = await file.createWritable()
  await writable.write(blob)
  await writable.close()
}

function saveBlob(blob: Blob, name: string) {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
}

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

// Remembered options are a convenience: storage can be missing or blocked
// (private mode), so every access is guarded.
function loadOptions(): Partial<StampOptions> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function saveOptions(options: StampOptions) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(options))
  } catch {
    // Not remembered this time.
  }
}
