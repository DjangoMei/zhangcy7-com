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
  const compactRoom = window.matchMedia("(max-width: 760px)").matches;
  const PDFJS_VERSION = "5.4.530";
  const PDFJS_MODULE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
  const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  let entries = [];
  let currentIndex = 0;
  let activeScroller = null;
  let activePanelIndex = 0;
  let activePanelCount = 0;
  let renderToken = 0;
  let pdfJsPromise = null;

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
    if (!activeScroller) {
      progress.style.transform = "scaleX(1)";
      return;
    }
    if (activeScroller.classList.contains("is-pdf")) {
      const current = Number(activeScroller.dataset.pdfPage || 1);
      const total = Number(activeScroller.dataset.pdfPages || 1);
      progress.style.transform = `scaleX(${Math.max(.04, current / total)})`;
      return;
    }
    if (activePanelCount > 1) {
      progress.style.transform = `scaleX(${(activePanelIndex + 1) / activePanelCount})`;
      return;
    }
    const range = activeScroller.scrollHeight - activeScroller.clientHeight;
    const value = range > 0 ? activeScroller.scrollTop / range : 1;
    progress.style.transform = `scaleX(${Math.max(.04, Math.min(1, value))})`;
  }

  function bindScroller(scroller) {
    activeScroller?.removeEventListener("scroll", updateProgress);
    activeScroller = scroller;
    activePanelIndex = 0;
    activePanelCount = Number(activeScroller?.dataset.panelCount || 0);
    activeScroller?.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
  }

  function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(PDFJS_MODULE).then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return pdfjsLib;
      });
    }
    return pdfJsPromise;
  }

  async function mountPdfViewer(scroller, entry, token) {
    const toolbar = scroller.querySelector(".pdf-viewer-toolbar");
    const stage = scroller.querySelector(".pdf-page-stage");
    const canvasElement = scroller.querySelector("canvas");
    const status = scroller.querySelector("[data-pdf-status]");
    const previous = scroller.querySelector("[data-pdf-prev]");
    const next = scroller.querySelector("[data-pdf-next]");
    let documentHandle = null;
    let pageNumber = 1;
    let drawing = false;
    let queuedPage = null;

    const showFailure = () => {
      stage.replaceChildren();
      const fallback = document.createElement("div");
      fallback.className = "pdf-viewer-error";
      fallback.innerHTML = "<strong>课件暂时未能渲染</strong><span>请检查网络后点击重试。</span>";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "重新载入";
      retry.addEventListener("click", () => window.location.reload());
      fallback.append(retry);
      stage.append(fallback);
      status.textContent = "载入失败";
      previous.disabled = true;
      next.disabled = true;
    };

    const renderPage = async (requestedPage) => {
      if (!documentHandle || token !== renderToken) return;
      const safePage = Math.max(1, Math.min(documentHandle.numPages, requestedPage));
      if (drawing) {
        queuedPage = safePage;
        return;
      }
      drawing = true;
      pageNumber = safePage;
      scroller.dataset.pdfPage = String(pageNumber);
      status.textContent = `${pad(pageNumber)} / ${pad(documentHandle.numPages)}`;
      previous.disabled = pageNumber <= 1;
      next.disabled = pageNumber >= documentHandle.numPages;
      updateProgress();
      try {
        const page = await documentHandle.getPage(pageNumber);
        if (token !== renderToken) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(220, stage.clientWidth - 24);
        const availableHeight = Math.max(260, stage.clientHeight - 20);
        const fitScale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        const renderViewport = page.getViewport({ scale: fitScale * pixelRatio });
        const displayViewport = page.getViewport({ scale: fitScale });
        canvasElement.width = Math.floor(renderViewport.width);
        canvasElement.height = Math.floor(renderViewport.height);
        canvasElement.style.width = `${Math.floor(displayViewport.width)}px`;
        canvasElement.style.height = `${Math.floor(displayViewport.height)}px`;
        const context = canvasElement.getContext("2d", { alpha: false });
        await page.render({ canvasContext: context, viewport: renderViewport }).promise;
      } catch {
        if (token === renderToken) showFailure();
      } finally {
        drawing = false;
        if (queuedPage !== null && queuedPage !== pageNumber) {
          const nextQueuedPage = queuedPage;
          queuedPage = null;
          renderPage(nextQueuedPage);
        } else {
          queuedPage = null;
        }
      }
    };

    scroller.pdfNavigate = (delta) => renderPage(pageNumber + delta);
    previous.addEventListener("click", () => scroller.pdfNavigate(-1));
    next.addEventListener("click", () => scroller.pdfNavigate(1));

    try {
      const pdfjsLib = await loadPdfJs();
      if (token !== renderToken) return;
      documentHandle = await pdfjsLib.getDocument({ url: entry.download }).promise;
      if (token !== renderToken) return;
      scroller.dataset.pdfPages = String(documentHandle.numPages);
      toolbar.hidden = false;
      await renderPage(1);
      let resizeTimer = 0;
      const resizeObserver = new ResizeObserver(() => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => renderPage(pageNumber), 120);
      });
      resizeObserver.observe(stage);
      scroller.pdfCleanup = () => resizeObserver.disconnect();
    } catch {
      if (token === renderToken) showFailure();
    }
  }

  function buildWritingPanel(entry) {
    const scroller = document.createElement("div");
    scroller.className = "workroom-scroll writing-scroll";

    if (entry.format === "PDF") {
      scroller.classList.add("is-pdf");
      scroller.innerHTML = `
        <div class="pdf-viewer-toolbar" hidden>
          <button type="button" data-pdf-prev aria-label="上一页课件">← 上一页</button>
          <strong data-pdf-status>载入中…</strong>
          <button type="button" data-pdf-next aria-label="下一页课件">下一页 →</button>
        </div>
        <div class="pdf-page-stage" aria-live="polite">
          <canvas aria-label="${entry.title} 课件页面"></canvas>
          <p class="pdf-viewer-loading">正在载入课件…</p>
        </div>`;
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
      stage.dataset.panelCount = String(entry.srcs.length);
      const triptych = document.createElement("div");
      triptych.className = "glass-triptych";
      entry.srcs.forEach((source, index) => {
        const figure = document.createElement("figure");
        figure.dataset.panelIndex = String(index);
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
      activeScroller?.pdfCleanup?.();
      renderToken += 1;
      const token = renderToken;
      canvas.replaceChildren(scroller);
      title.textContent = entry.title;
      format.textContent = entry.subtitle ? `${entry.format} · ${entry.subtitle}` : entry.format;
      counter.textContent = entry.layout === "triptych" && compactRoom
        ? `01 / ${pad(entry.srcs.length)}`
        : `${pad(currentIndex + 1)} / ${pad(entries.length)}`;
      prevButton?.setAttribute("aria-label", entry.layout === "triptych" ? "上一张作品" : "上一件作品");
      nextButton?.setAttribute("aria-label", entry.layout === "triptych" ? "下一张作品" : "下一件作品");
      if (sourceLink) {
        sourceLink.hidden = true;
      }
      let activeButton = null;
      list.querySelectorAll("[data-work-index]").forEach((button, buttonIndex) => {
        button.classList.toggle("is-active", buttonIndex === currentIndex);
        button.setAttribute("aria-pressed", String(buttonIndex === currentIndex));
        if (buttonIndex === currentIndex) activeButton = button;
      });
      if (compactRoom && activeButton) {
        const targetLeft = activeButton.offsetLeft - (list.clientWidth - activeButton.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(0, targetLeft), behavior: reduceMotion ? "auto" : "smooth" });
      }
      bindScroller(scroller);
      if (entry.format === "PDF") mountPdfViewer(scroller, entry, token);
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
    room.classList.toggle("is-single-entry", entries.length <= 1);
    renderList();
    renderEntry(0, { immediate: true });
  }

  function navigatePanel(delta) {
    if (!activeScroller || activePanelCount <= 1) return false;
    activePanelIndex = Math.max(0, Math.min(activePanelCount - 1, activePanelIndex + delta));
    activeScroller.scrollTo({ left: activeScroller.clientWidth * activePanelIndex, behavior: reduceMotion ? "auto" : "smooth" });
    counter.textContent = `${pad(activePanelIndex + 1)} / ${pad(activePanelCount)}`;
    updateProgress();
    return true;
  }

  prevButton?.addEventListener("click", () => {
    if (!navigatePanel(-1)) renderEntry(currentIndex - 1);
  });
  nextButton?.addEventListener("click", () => {
    if (!navigatePanel(1)) renderEntry(currentIndex + 1);
  });
  upButton?.addEventListener("click", () => {
    if (activeScroller?.pdfNavigate) activeScroller.pdfNavigate(-1);
    else activeScroller?.scrollBy({ top: -activeScroller.clientHeight * .78, behavior: reduceMotion ? "auto" : "smooth" });
  });
  downButton?.addEventListener("click", () => {
    if (activeScroller?.pdfNavigate) activeScroller.pdfNavigate(1);
    else activeScroller?.scrollBy({ top: activeScroller.clientHeight * .78, behavior: reduceMotion ? "auto" : "smooth" });
  });

  let swipeStart = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (!compactRoom) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  canvas.addEventListener("pointercancel", () => { swipeStart = null; }, { passive: true });
  canvas.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    if (activeScroller?.pdfNavigate) {
      activeScroller.pdfNavigate(deltaX < 0 ? 1 : -1);
      return;
    }
    if (activePanelCount > 1) {
      navigatePanel(deltaX < 0 ? 1 : -1);
      return;
    }
    if (entries.length <= 1) return;
    renderEntry(currentIndex + (deltaX < 0 ? 1 : -1));
  }, { passive: true });

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
