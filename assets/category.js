function initializePriceFilters() {
  const minInput = document.querySelector("#min-price");
  const maxInput = document.querySelector("#max-price");
  const filterButton = document.querySelector("#apply-filters");

  if (minInput === null || maxInput === null || filterButton === null) return;

  const urlParams = new URLSearchParams(window.location.search); // Set min and max values from query params
  const min = urlParams.get("min");
  const max = urlParams.get("max");
  min ? (minInput.value = min) : urlParams.delete("min");
  max ? (maxInput.value = max) : urlParams.delete("max");

  !min && !max
    ? document.querySelector(".theme-filters__tag--remove-price").classList.add("d-none")
    : document.querySelector(".theme-filters__tag--remove-price").classList.remove("d-none");

  const addEnterKeyListener = (input) => {
    input.addEventListener("keypress", function (event) {
      if (event.key === "Enter") submitFilters();
    });
  };

  addEnterKeyListener(minInput);
  addEnterKeyListener(maxInput);

  const handleError = () => {
    const messageElement = document.querySelector("#theme-filters-price .theme-filters__message");
    messageElement.classList.remove("d-none");
    messageElement.classList.add("d-block");
    filterButton.disabled = true;
  };

  const handleSuccess = () => {
    const messageElement = document.querySelector("#theme-filters-price .theme-filters__message");
    messageElement.classList.add("d-none");
    messageElement.classList.remove("d-block");
    filterButton.disabled = false;
  };

  const validatePrices = () => {
    const minValue = parseInt(minInput.value);
    const maxValue = parseInt(maxInput.value);
    minValue > maxValue ? handleError() : handleSuccess();
  };

  // validate prices when both inputs lose focus
  [minInput, maxInput].forEach(function (input) {
    input.addEventListener("blur", function () {
      setTimeout(() => {
        if (document.activeElement !== minInput && document.activeElement !== maxInput) validatePrices();
      }, 0);
    });
  });

  validatePrices();
  clearEmptyURLParams();
}

function clearEmptyURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  for (const key of urlParams.keys()) if (urlParams.get(key) === "") urlParams.delete(key);
  window.history.replaceState({}, "", `${window.location.pathname}?${urlParams.toString()}`);
}

function submitFilters() {
  document.getElementById("filters-form").requestSubmit();
}

function clearAllFilters() {
  window.location = window.location.href.split("?")[0];
}

function removePriceFilters() {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete("min");
  urlParams.delete("max");
  window.location = `${window.location.pathname}?${urlParams.toString()}`;
}

function moveFilters() {
  $(window).width() >= 768
    ? $(".theme-filters").appendTo(".theme-section__filters")
    : $(".theme-filters").appendTo(".sidebar-body__filters");
}

jQuery(() => {
  console.info(`[${new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false })}] Loaded category.js`);

  initializePriceFilters();

  if (IS_PREVIEW === false) {
    moveFilters();
    window.addEventListener("resize", moveFilters);
  }
});
