// The visitor's theme choice. "system" stores nothing and leaves
// data-theme off, so the CSS follows prefers-color-scheme.
// The storage key is repeated in Base.astro's inline <head> script.

export type Theme = "light" | "dark" | "system"

const KEY = "datestamp:theme"

export function storedTheme(): Theme {
  try {
    const theme = localStorage.getItem(KEY)
    return theme === "light" || theme === "dark" ? theme : "system"
  } catch {
    return "system"
  }
}

export function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    if (theme === "system") localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Not remembered; the theme still changes for this page.
  }
}

export function mountThemeSwitch(root: HTMLElement) {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-theme-choice]")
  // Every switch on the page (the navbar's and the mobile menu's) shows the choice.
  const mark = (theme: Theme) =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-theme-choice]")
      .forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme)))

  mark(storedTheme())
  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      const theme = button.dataset.themeChoice as Theme
      mark(theme)
      changeSmoothly(() => applyTheme(theme))
      // The narrow navbar's menu closes once a theme is picked.
      button.closest("details")?.removeAttribute("open")
    }),
  )
}

// While the theme changes, the colour tokens fade over 0.3 s (the
// .theme-transition rules in global.css explain why only the tokens), and
// the class comes off right after, so hovers keep their own transitions.
// Not a view transition: it swaps a snapshot for the live page at the end,
// and anything still animating its own colour then visibly jumps.
let transitionEnd: ReturnType<typeof setTimeout> | undefined

function changeSmoothly(change: () => void) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return change()
  const root = document.documentElement
  root.classList.add("theme-transition")
  change()
  clearTimeout(transitionEnd)
  transitionEnd = setTimeout(() => root.classList.remove("theme-transition"), 350)
}
