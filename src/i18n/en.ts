// The reference locale: every other locale file is typed as this one.

import type { DateFormat } from "../lib/stamp"

export default {
  languageName: "English",
  // The date formats in the editor, the country's own first (the first is the default).
  // English pages serve the UK and the US alike: both day-first and month-first.
  dateFormats: ["dmy-slash", "mdy", "dmy-slash-time", "retro", "iso"] as DateFormat[],
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "System" },
  slugs: {
    iphone: "how-to-add-date-to-photo-on-iphone",
    android: "how-to-add-date-to-photo-on-android",
    batch: "add-date-to-multiple-photos",
    retro: "old-camera-date-stamp-effect",
    privacy: "privacy-policy",
  },
  home: {
    title: "Add Date to Photo – Free & Private | DateStamp",
    description:
      "Add the date to your photos in seconds. Reads when each photo was taken, retro film-camera style, many photos at once. Nothing is uploaded.",
    h1: "Add date to photo",
    subtitle: "The date each photo was taken fills in by itself. Your photos never leave your device.",
    facts: ["Free", "No sign-up", "Photos stay with you"],
    steps: {
      title: "Dates on your photos in three steps",
      subtitle: "No app to install and no account. Works the same on a computer and a phone.",
      items: [
        { title: "Add photos", body: "Drag them onto the page or pick them from your disk or phone gallery. One or a whole album." },
        { title: "The date fills in by itself", body: "It comes from the photo's own data. If it's missing, type it in under the thumbnail." },
        { title: "Save, no ZIP files", body: "Into a folder you choose on a computer, or straight to the gallery on a phone." },
      ],
    },
    examples: {
      title: "How it looks",
      captions: ["White, with the time", "Label, bottom left", "Retro, like a film camera"],
      photoBy: "Photo",
      alts: { mountain: "Snow on a rocky mountain with a valley below", forest: "Tall pine trees in a sunlit forest", grass: "Fresh grass on a forest floor in the morning light" },
    },
    faqTitle: "Questions",
    faq: [
      {
        q: "Where does the date come from?",
        a: "From the photo's EXIF data (DateTimeOriginal), which cameras and phones save when you take the picture. If a photo has none – screenshots, photos from messengers – the file's date is used, and you can change it for every photo.",
      },
      {
        q: "Are my photos uploaded?",
        a: "No. DateStamp runs entirely in your browser. You can even turn off the internet once the page has loaded.",
      },
      {
        q: "Does it work on iPhone and Android?",
        a: "Yes, in Safari, Chrome and any modern browser. On a phone you can share the result straight to your gallery or a messenger.",
      },
      {
        q: "How many photos at once?",
        a: "As many as you like. Big albums are processed one by one, and the bar shows how many are done.",
      },
    ],
    guidesTitle: "Guides",
  },
  guides: {
    iphone: {
      title: "How to Add the Date to a Photo on iPhone (Free) | DateStamp",
      description:
        "The iPhone camera can't print the date on photos. Here is how to add it in a few taps – free, in Safari, without installing an app.",
      h1: "How to add the date to a photo on iPhone",
      intro:
        "The iPhone saves the date of every photo, but it never shows it on the picture itself, and the Camera app has no setting for it. DateStamp adds it in Safari, without an app:",
      steps: [
        "Open this page in Safari on your iPhone.",
        "Tap “Choose photos” and pick one or more photos from your library.",
        "DateStamp reads the date each photo was taken. Change it under the photo if you need to.",
        "Pick a style – the orange retro date looks like a 90s film camera.",
        "Tap “Share” and then “Save Image” – the photo with the date lands in your Photos.",
      ],
      tipTitle: "Good to know",
      tip: "Photos you received in a messenger often lose their original date. DateStamp then uses the file's date – check it before saving.",
      cta: "Add the date now",
      tools: ["iPhone", "Safari"],
    },
    android: {
      title: "How to Add the Date to a Photo on Android | DateStamp",
      description:
        "Android's camera rarely prints the date on photos. Here is how to add it in a few taps – free, in Chrome, without installing an app.",
      h1: "How to add the date to a photo on Android",
      intro:
        "Most Android phones save the date of every photo but never print it on the picture. DateStamp adds it in Chrome, with no app to install:",
      steps: [
        "Open this page in Chrome (or any browser) on your phone.",
        "Tap “Choose photos” and pick one or more photos from your gallery.",
        "DateStamp reads the date each photo was taken. Change it under the thumbnail if you need to.",
        "Pick a style, the format and the corner for the date.",
        "Tap “Save to gallery” and choose your gallery app – the photos with the date are saved there.",
      ],
      tipTitle: "Good to know",
      tip: "Photos sent through WhatsApp or Messenger often lose their original date. DateStamp then shows “file date” in orange – check it before saving.",
      cta: "Add the date now",
      tools: ["Android phone", "Chrome"],
    },
    batch: {
      title: "Add Date to Multiple Photos at Once (Free) | DateStamp",
      description:
        "Put the date on a whole album in one go. Each photo gets its own date from the camera, and they save to a folder or your gallery, no ZIP.",
      h1: "How to add the date to many photos at once",
      intro:
        "Dating a whole holiday album one photo at a time takes ages. DateStamp does them all together, each with the date it was taken:",
      steps: [
        "Choose all the photos at once, or drag them onto the page.",
        "Wait a moment while they load – the bar shows how many are ready.",
        "Check the dates: photos without camera data are marked “file date”; change those under the thumbnail.",
        "Pick one style, format and corner – it applies to every photo.",
        "Save them all: into a folder on a computer, or to the gallery on a phone. Finished photos get a green frame.",
      ],
      tipTitle: "Good to know",
      tip: "No ZIP files: on a computer you choose a folder and every photo lands there as a normal file. A ZIP is still there if you want one.",
      cta: "Add the date now",
      tools: ["A computer or a phone", "A web browser"],
    },
    retro: {
      title: "Old Camera Date Stamp Effect on Photos | DateStamp",
      description:
        "Get the orange date of a 90s film camera on your photos – '98 7 14 style, in the corner, from each photo's real date. Free, in your browser.",
      h1: "The retro date stamp of old film cameras",
      intro:
        "Point-and-shoot film cameras printed the date in orange digits in the corner of every photo. DateStamp recreates that look with each photo's real date:",
      steps: [
        "Choose your photos.",
        "Pick the “Retro” style – orange digits with a soft glow.",
        "For the most authentic look, choose the '98 7 14 format and the bottom-right corner.",
        "Set the size: small, like on a real print.",
        "Save the photos.",
      ],
      tipTitle: "Good to know",
      tip: "The date comes from the photo itself, so even new phone photos get the year they were taken – not a made-up one.",
      cta: "Add the date now",
      tools: ["A web browser"],
    },
  },
  privacy: {
    title: "Privacy Policy | DateStamp",
    description: "How DateStamp handles your data: photos never leave your device, ads by Google AdSense use cookies.",
    h1: "Privacy policy",
    sections: [
      { title: "Your photos", body: "DateStamp works entirely in your browser. Photos you choose are processed on your device and are never uploaded, stored or seen by us." },
      { title: "Settings in your browser", body: "Your chosen style, format and position are remembered in your browser's local storage, only on your device. Clearing site data removes them." },
      { title: "Advertising", body: "This site shows ads from Google AdSense, which keep it free. On your first visit we ask for your consent to advertising cookies. If you agree, Google and its partners may match ads to your visits to this and other sites; if you refuse, the ads are not personalised. You can change your choice at any time with “Cookie settings” at the bottom of the page; it is kept in your browser. How Google uses data: policies.google.com/technologies/ads." },
      { title: "Statistics", body: "With your consent we use Google Analytics 4 to learn how many people visit the site and how the editor is used (for example how many photos were saved and in which style). Photos, file names and the dates in them are never sent. Without consent Google Analytics is not loaded at all. How Google uses data: policies.google.com/technologies/partner-sites." },
    ],
    contact: "Questions about privacy: {email}",
  },
  editor: {
    pick: "Choose photos",
    privacy: "Photos stay on your device",
    format: "Format",
    clear: "Clear",
    working: "Working…",
    downloadAll: "Download all",
    saveToFolder: "Save to a folder",
    saveToGallery: "Save to gallery",
    downloadAsZip: "Download as ZIP",
    saveNow: "Save the photos",
    progressLoading: "Loading photos",
    progressExporting: "Adding the date",
    progressZipping: "Packing the ZIP",
    progressDone: "Done",
    progressFailed: "Something went wrong – try again",
    stateQueued: "Waiting",
    stateWorking: "Working",
    stateDone: "Done",
    cannotOpen: "This browser cannot open {name}. HEIC photos open in Safari – or export them as JPEG first.",
    remove: "Remove",
    dropTitle: "Drop photos here",
    dropHint: "one or a whole album at once",
    style: "Date style",
    styles: { classic: "White", label: "Label", retro: "Retro" },
    position: "Date position",
    positions: { "bottom-right": "Bottom right", "bottom-left": "Bottom left", "top-right": "Top right", "top-left": "Top left" },
    size: "Size",
    sizes: { small: "small", medium: "medium", large: "large" },
    sourceFile: "file date",
    changeDate: "Change date",
    addMore: "Add more photos",
    saveFirst: "Add photos first",
    saving: "Saving…",
    locked: "Settings are locked until saving is done.",
    doneHint: "Finished photos have a green frame.",
  },
  nav: { editor: "Add date", how: "How it works", faq: "FAQ", guides: "Guides", menu: "Menu", close: "Close menu" },
  consent: {
    text: "We use cookies for visitor statistics (Google Analytics) and for the ads that keep this site free (Google AdSense). Both are optional. Your photos are never uploaded. Details in our",
    policy: "privacy policy",
    accept: "Accept all",
    reject: "Reject all",
    customize: "Customize",
    save: "Save choice",
    settings: "Cookie settings",
    necessary: { title: "Necessary", body: "Remember your settings and this choice. Always on." },
    analytics: { title: "Statistics", body: "Google Analytics: how many people visit and how the editor is used. Never your photos or file names." },
    ads: { title: "Advertising", body: "Ads matched to your interests. Without consent the ads are not personalised." },
  },
  ads: { label: "Advertisement" },
  footer: "Made in the browser. Your photos never leave your device.",
}
