(() => {
  const room = document.querySelector("[data-workroom]");
  if (!room) return;

  const list = room.querySelector(".workroom-list");
  const canvas = room.querySelector(".workroom-canvas");
  const title = room.querySelector("[data-current-title]");
  const format = room.querySelector("[data-current-format]");
  const counter = room.querySelector("[data-current-count]");
  const sourceLink = room.querySelector("[data-source-link]");
  const progress = room.querySelector(".workroom-progress > i");
  const prevButton = room.querySelector("[data-room-prev]");
  const nextButton = room.querySelector("[data-room-next]");
  const upButton = room.querySelector("[data-room-up]");
  const downButton = room.querySelector("[data-room-down]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let entries = [];
  let currentIndex = 0;
  let activeScroller = null;

  const pad = (value) => String(value).padStart(2, "0");

  function setSemanticTitle(heading, text) {
    const parts = text
      .replace(/\s*\|\s*/g, "｜\n")
      .replace(/([，！])\s*/g, "$1\n")
      .split(/\s+|\n+/)
      .map((part) => part.trim())
      .filter(Boolean);
    heading.classList.add("semantic-title");
    parts.forEach((part) => {
      const phrase = document.createElement("span");
      phrase.textContent = part;
      heading.append(phrase);
    });
  }

  function updateProgress() {
    if (!activeScroller || activeScroller.classList.contains("is-pdf")) {
      progress.style.transform = "scaleX(1)";
      return;
    }
    const range = activeScroller.scrollHeight - activeScroller.clientHeight;
    const value = range > 0 ? activeScroller.scrollTop / range : 1;
    progress.style.transform = `scaleX(${Math.max(.04, Math.min(1, value))})`;
  }

  function bindScroller(scroller) {
    activeScroller?.removeEventListener("scroll", updateProgress);
    activeScroller = scroller;
    activeScroller?.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
  }

  function buildWritingPanel(entry) {
    const scroller = document.createElement("div");
    scroller.className = "workroom-scroll writing-scroll";

    if (entry.format === "PDF") {
      scroller.classList.add("is-pdf");
      const frame = document.createElement("iframe");
      frame.className = "writing-pdf-frame";
      frame.src = `${entry.download}#toolbar=0&navpanes=0&view=Fit`;
      frame.title = `${entry.title} PDF 滚动预览`;
      frame.loading = "eager";
      scroller.append(frame);
      return scroller;
    }

    const article = document.createElement("article");
    article.className = "writing-paper";
    entry.blocks.forEach((block, index) => {
      if (block.type === "heading") {
        const heading = document.createElement(index === 0 ? "h1" : "h2");
        if (index === 0) setSemanticTitle(heading, block.text);
        else heading.textContent = block.text;
        article.append(heading);
      } else if (block.type === "paragraph") {
        const paragraph = document.createElement("p");
        paragraph.textContent = block.text;
        article.append(paragraph);
      } else if (block.type === "image") {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = block.src;
        image.alt = block.alt || "文章配图";
        image.loading = "lazy";
        figure.append(image);
        article.append(figure);
      }
    });
    scroller.append(article);
    return scroller;
  }

  function buildImagePanel(entry) {
    if (entry.layout === "triptych") {
      const stage = document.createElement("div");
      stage.className = "workroom-scroll triptych-scroll";
      const triptych = document.createElement("div");
      triptych.className = "glass-triptych";
      entry.srcs.forEach((source, index) => {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = source;
        image.alt = `${entry.title} ${pad(index + 1)}`;
        if (entry.sizes?.[index]) {
          image.width = entry.sizes[index][0];
          image.height = entry.sizes[index][1];
        }
        image.loading = "eager";
        figure.append(image);
        triptych.append(figure);
      });
      stage.append(triptych);
      return stage;
    }
    const scroller = document.createElement("div");
    scroller.className = `workroom-scroll image-scroll ${entry.long ? "is-long" : "is-poster"}`;
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = entry.src;
    image.alt = entry.title;
    if (entry.width && entry.height) {
      image.width = entry.width;
      image.height = entry.height;
    }
    image.loading = "eager";
    figure.append(image);
    scroller.append(figure);
    return scroller;
  }

  function renderEntry(index, { immediate = false } = {}) {
    if (!entries.length) return;
    currentIndex = (index + entries.length) % entries.length;
    const entry = entries[currentIndex];
    const show = () => {
      const scroller = room.dataset.workroom === "writing" ? buildWritingPanel(entry) : buildImagePanel(entry);
      canvas.replaceChildren(scroller);
      title.textContent = entry.title;
      format.textContent = entry.subtitle ? `${entry.format} · ${entry.subtitle}` : entry.format;
      counter.textContent = `${pad(currentIndex + 1)} / ${pad(entries.length)}`;
      if (sourceLink && entry.download) {
        sourceLink.href = entry.download;
        sourceLink.hidden = false;
        sourceLink.textContent = entry.format === "PDF" ? "打开 PDF ↗" : "下载原稿 ↓";
      } else if (sourceLink) {
        sourceLink.hidden = true;
      }
      list.querySelectorAll("[data-work-index]").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === currentIndex);
        button.setAttribute("aria-pressed", String(buttonIndex === currentIndex));
      });
      bindScroller(scroller);
      requestAnimationFrame(() => canvas.classList.remove("is-switching"));
    };

    if (immediate || reduceMotion) show();
    else {
      canvas.classList.add("is-switching");
      window.setTimeout(show, 170);
    }
  }

  function renderList() {
    list.replaceChildren();
    entries.forEach((entry, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.workIndex = String(index);
      button.innerHTML = `<span>${pad(index + 1)}</span><b></b><small>${entry.format}</small>`;
      button.querySelector("b").textContent = entry.title;
      button.addEventListener("click", () => renderEntry(index));
      list.append(button);
    });
  }

  function initialize(data) {
    entries = data;
    renderList();
    renderEntry(0, { immediate: true });
  }

  prevButton?.addEventListener("click", () => renderEntry(currentIndex - 1));
  nextButton?.addEventListener("click", () => renderEntry(currentIndex + 1));
  upButton?.addEventListener("click", () => activeScroller?.scrollBy({ top: -activeScroller.clientHeight * .78, behavior: reduceMotion ? "auto" : "smooth" }));
  downButton?.addEventListener("click", () => activeScroller?.scrollBy({ top: activeScroller.clientHeight * .78, behavior: reduceMotion ? "auto" : "smooth" }));

  room.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") renderEntry(currentIndex - 1);
    if (event.key === "ArrowRight") renderEntry(currentIndex + 1);
  });

  if (room.dataset.workroom === "writing") {
    fetch("assets/portfolio/writing.json")
      .then((response) => {
        if (!response.ok) throw new Error("Writing manifest unavailable");
        return response.json();
      })
      .then(initialize)
      .catch(() => {
        canvas.innerHTML = '<p class="workroom-error">作品暂时无法载入，请稍后刷新页面。</p>';
      });
  } else {
    const data = JSON.parse(document.querySelector("#workroom-data")?.textContent || "[]");
    initialize(data);
  }
})();
