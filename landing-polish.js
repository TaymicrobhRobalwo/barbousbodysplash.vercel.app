(function () {
  const primary = "#FE2C56";

  function apply() {
    document.querySelectorAll('a[href="/checkout"]').forEach((button) => {
      button.style.background = primary;
    });

    document.querySelectorAll("span").forEach((span) => {
      const text = span.textContent.trim();
      if (text === "97,49" || text === "R$97,49" || text === "-57%") {
        span.style.color = text === "-57%" ? "#fff" : primary;
        if (text === "-57%") span.style.background = primary;
      }
    });

    const amount = Array.from(document.querySelectorAll("span")).find((span) => span.textContent.trim() === "97,49");
    if (amount?.previousElementSibling?.textContent.trim() === "R$") {
      amount.previousElementSibling.style.color = primary;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
  setTimeout(apply, 500);
  setTimeout(apply, 1500);
})();
