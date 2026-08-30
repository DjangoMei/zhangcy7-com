const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  const destination = event.key === "ArrowLeft" ? document.body.dataset.prev :
    event.key === "ArrowRight" ? document.body.dataset.next : null;

  if (destination) window.location.href = destination;
});
