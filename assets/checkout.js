function cleanShippingSelectErrors() {
  //clean errors
  $("#shipping_address").each(function () {
    $(this)
      .children(".select-field")
      .each(function () {
        $(this).children(".error").remove();
      });
  });
}

function cleanEstimates() {
  // remove any previous messages & placeholders
  $("#shipping_options li").each(function () {
    $(this)
      .children("span")
      .each(function () {
        if ($(this).is(":empty")) {
          $(this).remove();
        }
      });
  });

  // add empty placeholder messages
  $("#shipping_options li").each(function () {
    $(this).append("<span></span>");
  });
}

function appendShippingInformation() {
  if ($(".shipping-information").length === 0)
    $(`<p class='shipping-information'>${I18N.fill_country_region_shipping}</p>`).insertAfter("#shipping h2");
}

function removeShippingInformation() {
  if ($(".shipping-information").length > 0) $(".shipping-information").remove();
}

function shippingEstimates() {
  cleanEstimates();
  removeShippingInformation();

  const countryValue = $("#order_shipping_address_country").val();
  const regionValue = $("#order_shipping_address_region").val();
  const addressValue = $("#order_shipping_address_address").val();

  // Check if countryValue, regionValue, and addressValue are present
  if (!countryValue || !regionValue || !addressValue) {
    appendShippingInformation();
    return;
  }

  if (countryValue === "" && regionValue === "") appendShippingInformation();
  else {
    cleanShippingSelectErrors();
    const municipalityValue = $("#order_shipping_address_municipality").val();
    const postalValue = $("#order_shipping_address_postal").val();
    const cityValue = $("#order_shipping_address_city").val();

    $("#shipping_options .loading-spinner__wrapper").remove();
    $("#shipping_options").append(`<div class="loading-spinner__wrapper"><div class="loading-spinner"></div></div>`);

    $.ajax({
      method: "POST",
      url: "/checkout/shipping_estimate",
      data: {
        estimate: {
          country: countryValue,
          region: regionValue,
          municipality: municipalityValue,
          postal: postalValue,
          city: cityValue,
          address: addressValue,
        },
      },
    }).done(function (data) {
      $("#shipping_options .shipping-item").hide();
      $("#shipping_options .loading-spinner__wrapper").remove();
      let atLeastOneShippingMethod = false;
      for (let i = 0; i < data.length; i++) {
        const shippingMethod = $(`#shipping_options #order_shipping_method_${data[i].table.id}`);

        if (data[i].table.error) {
          shippingMethod.parent().hide();
          shippingMethod.attr("disabled", true); // disable options with errors
          shippingMethod.prop("checked", false);
          shippingMethod.parent().append(`<p class="shipping-information">${data[i].table.error_message}</p>`); // add error messages
        } else {
          atLeastOneShippingMethod = true;
          shippingMethod.parent().show();
          shippingMethod.attr("disabled", false); // enable options
          if ($("#shipping_options").find("input[type='radio']:checked").not("[disabled]").length == 0) {
            shippingMethod.prop("checked", true);
          }

          const cash = data[i].table.shipping_method_type == "cash_on_delivery";
          const finalPrice = data[i].table.price;
          const priceMessage = cash ? data[i].table.message : finalPrice;
          shippingMethod.parent().append(`<p class="shipping-information">${priceMessage}</p>`); // add formatted shipping prices
        }
      }

      if (!atLeastOneShippingMethod) {
        $("#shipping_options").append(
          `<p class="loading-spinner__wrapper loading-spinner__wrapper--warn">${I18N.no_shipping_methods}</p>`,
        );
      }

      function disableReviewOrderIfInvalidShipping() {
        const validOption = $("#shipping_options").find("input[type='radio']:checked").not("[disabled]").length > 0;
        $("#submit_review_order_2").prop("disabled", !validOption);
      }

      jQuery(function () {
        disableReviewOrderIfInvalidShipping();
      });

      $("#shipping_options input[type='radio']").on("change", disableReviewOrderIfInvalidShipping);
    });
  }
}

function setupShippingListeners() {
  let debounceTimer = null; // so it does only a single request instead of lots of them
  const elements = [
    "#order_shipping_address_country",
    "#order_shipping_address_region",
    "#order_shipping_address_municipality",
    "#order_shipping_address_city",
    "#order_shipping_address_postal",
    "#order_shipping_address_address",
  ];

  $(elements.join(", ")).on("change", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => shippingEstimates(), 300);
  });

  $("#shipping_options li").each(function () {
    $(this).append("<span></span>"); // add empty messages - placeholders
  });

  shippingEstimates();
}

function toggleCartSummaryProductsOnClick() {
  $(".cart-summary__toggle-products").on("click", function () {
    $(this).toggleClass("active");
    $(".cart-summary__products").toggleClass("d-flex d-none");
  });
}

jQuery(() => {
  console.info(`[${new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false })}] Loaded checkout.js`);

  const shippingRequired = $(".cart-page").attr("data-shipping-required") === "true";
  if (shippingRequired) setupShippingListeners();

  toggleCartSummaryProductsOnClick();
});
