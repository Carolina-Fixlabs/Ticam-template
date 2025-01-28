function cartMessage() {
  if (window.location.href.endsWith("cart/estimate")) $("#set_shipping_button").focus();
  if (document.referrer.endsWith("cart/estimate")) $("#proceed_to_checkout").focus();

  const urlParams = new URLSearchParams(window.location.search); // get message from url params
  const message = urlParams.get("message");
  if (message == null) return;

  const messageElement = document.getElementById("alert-message"); // show element in HTML
  messageElement.innerText = message;
  messageElement.parentElement.classList.add("show");
  messageElement.parentElement.classList.remove("hidden");
}

function unlinkUnavailableShippingMethod() {
  const estimates = document.getElementById("estimates");
  if (!estimates) return;

  const dtElements = estimates.getElementsByTagName("dt");
  const ddElements = estimates.getElementsByTagName("dd");
  if (dtElements.length !== ddElements.length) return; // ensure dt and dd elements are paired correctly

  for (let i = 0; i < dtElements.length; i++) {
    const dt = dtElements[i];
    const inputElement = dt.querySelector("input[type='radio']");
    if (!inputElement.disabled) continue;

    const dd = ddElements[i];
    const anchor = dd.querySelector("a");
    if (!anchor) continue;

    if (anchor.href.startsWith(window.location.origin + "/error")) {
      const span = document.createElement("span");
      span.innerText = anchor.innerText;
      anchor.innerHTML = "<i class='ph ph-arrow-square-out'></i>";
      anchor.target = "_blank";
      dd.className = "d-flex align-items-center gap-1";
      dd.insertBefore(span, anchor);
    }
  }
}

jQuery(() => {
  console.info(`[${new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false })}] Loaded cart.js`);

  cartMessage();
  unlinkUnavailableShippingMethod();
});
