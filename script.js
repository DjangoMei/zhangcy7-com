const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const body = document.body;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
let navigating = false;

const curtain = document.createElement("div");
curtain.className = "page-curtain";
curtain.setAttribute("aria-hidden", "true");
body.append(curtain);

function navigateTo(destination) {
  if (!destination || navigating) return;
  navigating = true;

  if (reduceMotion) {
    window.location.href = destination;
    return;
  }

  curtain.animate(
    [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
    { duration: 430, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" }
  );
  document.querySelector("main")?.animate(
    [{ opacity: 1, transform: "scale(1)" }, { opacity: .64, transform: "scale(.992)" }],
    { duration: 400, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
  );
  window.setTimeout(() => { window.location.href = destination; }, 400);
}

document.addEventListener("click", (event) => {
  const anchor = event.target.closest?.("a[href]");
  if (!anchor || event.defaultPrevented || event.button !== 0) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (anchor.target || anchor.hasAttribute("download")) return;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.hash || url.href === window.location.href) return;
  event.preventDefault();
  navigateTo(url.href);
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const destination = event.key === "ArrowLeft" ? body.dataset.prev :
    event.key === "ArrowRight" ? body.dataset.next : null;
  if (destination) navigateTo(destination);
});

let wheelTotal = 0;
let wheelReset;
document.addEventListener("wheel", (event) => {
  if (event.ctrlKey || navigating) return;
  event.preventDefault();
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  wheelTotal += delta;
  window.clearTimeout(wheelReset);
  wheelReset = window.setTimeout(() => { wheelTotal = 0; }, 180);
  if (Math.abs(wheelTotal) < 90) return;
  navigateTo(wheelTotal > 0 ? body.dataset.next : body.dataset.prev);
  wheelTotal = 0;
}, { passive: false });

let touchStartX = 0;
let touchStartY = 0;
document.addEventListener("touchstart", (event) => {
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });
document.addEventListener("touchend", (event) => {
  const deltaX = event.changedTouches[0].clientX - touchStartX;
  const deltaY = event.changedTouches[0].clientY - touchStartY;
  const dominant = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  if (Math.abs(dominant) < 58) return;
  navigateTo(dominant < 0 ? body.dataset.next : body.dataset.prev);
}, { passive: true });

const routes = [
  ["index.html", "首页"],
  ["experience.html", "职业经历"],
  ["projects.html", "项目速览"],
  ["portfolio.html", "作品目录"],
  ["writing.html", "文字作品"],
  ["design-hand.html", "手工设计"],
  ["design-ai.html", "AI 设计"],
  ["video.html", "视频作品"],
  ["other.html", "其他作品"]
];
const currentRoute = window.location.pathname.split("/").pop() || "index.html";
const rail = document.createElement("nav");
rail.className = "page-rail";
rail.setAttribute("aria-label", "页面目录");
routes.forEach(([href, label]) => {
  const link = document.createElement("a");
  link.href = href;
  link.setAttribute("aria-label", label);
  link.title = label;
  if (href === currentRoute) link.setAttribute("aria-current", "page");
  rail.append(link);
});
body.append(rail);

function revealPage() {
  if (reduceMotion) return;
  const selectors = body.classList.contains("page-home")
    ? [".folio-header", ".home-lead", ".home-photo", ".home-dossier", ".home-notes > *"]
    : [".folio-header", ".spread-title > *", ".experience-board > *, .projects-board > *, .portfolio-board > *, .gallery-board > *", ".folio-turn"];
  const elements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  elements.forEach((element, index) => {
    const horizontal = index % 2 === 0 ? -14 : 14;
    element.animate(
      [
        { opacity: 0, transform: `translate3d(${horizontal}px, 12px, 0)`, filter: "blur(5px)" },
        { opacity: 1, transform: "translate3d(0,0,0)", filter: "blur(0)" }
      ],
      { duration: 720, delay: 45 + index * 58, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }
    );
  });
}
revealPage();

if (finePointer && !reduceMotion) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let spotlightFrame = 0;

  const halo = document.createElement("div");
  halo.className = "cursor-halo";
  halo.setAttribute("aria-hidden", "true");
  body.append(halo);

  function renderPointer() {
    currentX += (targetX - currentX) * .16;
    currentY += (targetY - currentY) * .16;
    body.style.setProperty("--mx", `${currentX}px`);
    body.style.setProperty("--my", `${currentY}px`);
    halo.style.transform = `translate3d(${currentX - halo.offsetWidth / 2}px,${currentY - halo.offsetHeight / 2}px,0)`;
    if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .3) {
      spotlightFrame = requestAnimationFrame(renderPointer);
    } else {
      spotlightFrame = 0;
    }
  }

  document.addEventListener("pointermove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    halo.classList.add("is-visible");
    halo.classList.toggle("is-active", Boolean(event.target.closest("a, button, .tilt-surface")));
    if (!spotlightFrame) spotlightFrame = requestAnimationFrame(renderPointer);
  });
  document.addEventListener("pointerleave", () => halo.classList.remove("is-visible"));

  document.querySelectorAll(".folio-nav a, .folio-turn a, .next-chapter").forEach((element) => {
    element.classList.add("magnetic-target");
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height;
      element.style.transform = `translate3d(${x * 7}px,${y * 5}px,0)`;
    });
    element.addEventListener("pointerleave", () => { element.style.transform = "translate3d(0,0,0)"; });
  });

  document.querySelectorAll(".project-row, .portfolio-board a, .gallery-slot").forEach((element) => {
    element.classList.add("tilt-surface");
    const glow = document.createElement("i");
    glow.className = "surface-glow";
    glow.setAttribute("aria-hidden", "true");
    element.append(glow);
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      element.style.setProperty("--tilt-x", `${(0.5 - py) * 3.2}deg`);
      element.style.setProperty("--tilt-y", `${(px - 0.5) * 3.2}deg`);
      element.style.setProperty("--tilt-lift", "-3px");
      element.style.setProperty("--shine-x", `${px * 100}%`);
      element.style.setProperty("--shine-y", `${py * 100}%`);
    });
    element.addEventListener("pointerleave", () => {
      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
      element.style.setProperty("--tilt-lift", "0");
    });
  });

  document.querySelectorAll(".home-photo, .accent-photo").forEach((frame) => {
    const image = frame.querySelector("img");
    if (!image) return;
    frame.addEventListener("pointermove", (event) => {
      const rect = frame.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      image.style.transform = `translate3d(${x * -8}px,${y * -8}px,0)`;
    });
    frame.addEventListener("pointerleave", () => { image.style.transform = "translate3d(0,0,0)"; });
  });
}

document.addEventListener("pointerdown", (event) => {
  const target = event.target.closest?.("a, button");
  if (!target || reduceMotion) return;
  target.classList.add("ink-host");
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("i");
  ripple.className = "ink-ripple";
  ripple.setAttribute("aria-hidden", "true");
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  target.append(ripple);
  window.setTimeout(() => ripple.remove(), 720);
});
