if ($(".header-search").length > 0 || $(".header .jumpseller-autocomplete").length > 0) {
  $(".header__link--search, .header__close-mobile-search").on("click", function () {
    $(".header-search").toggleClass("header-search--visible");
  });
}

window.onload = updatePagerUrl;

// This is necessary because the pager links are not updated when the customer opens its account details and then changes tab to wishlist
function updatePagerUrl() {
  const url = window.location.href;
  if (url.includes("customer") && !url.includes("target=wishlist")) {
    const elements = $(".pager");
    elements.find("a").each(function () {
      const splitted_url = $(this).attr("href").split("?");
      const new_url = splitted_url[0] + "?target=wishlist&" + splitted_url[1];
      $(this).attr("href", new_url);
    });
  }
}

const wishlistTab = document.getElementById("customer-account-wishlist-tab");
if (wishlistTab) {
  wishlistTab.addEventListener("click", function () {
    const url = window.location.href;
    if (url.includes("customer") && !url.includes("target=wishlist"))
      history.pushState(null, null, url + "?target=wishlist");
  });
}

const ordersTab = document.getElementById("customer-account-orders-tab");
if (ordersTab) {
  ordersTab.addEventListener("click", function () {
    history.pushState(null, null, "/customer");
  });
}

const accountDetailsTab = document.getElementById("customer-account-details-tab");
if (accountDetailsTab) {
  accountDetailsTab.addEventListener("click", function () {
    history.pushState(null, null, "/customer");
  });
}

function updateHeaderHeight() {
  const header = document.querySelector(".header");
  if (!header) return;

  const headerHeight = header.offsetHeight;
  const isMobile = $(window).width() < 768;

  document.documentElement.style.setProperty(`--header-height-${isMobile ? "mobile" : "desktop"}`, `${headerHeight}px`);
  document.documentElement.style.setProperty("--header-height", `${headerHeight}px`);

  // Adapt the top space for the sticky Product Gallery based on the Header height
  const $stickyProductGallery = $(".product-gallery__wrapper.sticky-md-top");
  if ($stickyProductGallery.length > 0) {
    $stickyProductGallery.each(function () {
      const parent = $(this).parents(".product-page");
      const topMargin = parent.css("--section-margin-top");
      const topPush = parseFloat(headerHeight) + 10;
      const topPushSlider = parseFloat(topMargin) + parseFloat(headerHeight) + 10;
      const isFixedHeader = $(".header").hasClass("header--fixed");
      const isPushHeader = $(".header").hasClass("header--push");
      if (isFixedHeader && isPushHeader) $(this).css("top", topPushSlider);
      else if (isFixedHeader) $(this).css("top", topPush);
    });
  }
}

const themeHeader = document.querySelector(".header");
if (themeHeader) {
  document.addEventListener("DOMContentLoaded", updateHeaderHeight); // update header height on DOM content loaded and when window is resized
  window.addEventListener("resize", updateHeaderHeight);

  const observer = new MutationObserver(updateHeaderHeight); // update header height whenever the content of the header changes
  observer.observe(themeHeader, { childList: true, subtree: true });
}

function adjustFlyoutSubmenusPosition() {
  // header flyout fix when submenus escape the viewport
  const adjustFlyoutPosition = ($itemSubmenu) => {
    const itemSubmenuOffset = $itemSubmenu.offset();
    const itemSubmenuWidth = $itemSubmenu.outerWidth();
    const windowWidth = $(window).width();

    // check if submenu goes off the screen on the right
    if (itemSubmenuOffset.left < 0 || itemSubmenuOffset.left + itemSubmenuWidth > windowWidth) {
      $itemSubmenu.attr("data-submenu-position", "force-right");
    }
  };

  // first level submenu > on click event
  $('.header-nav__anchor[data-event="click"]').on("click", function () {
    const $itemSubmenu = $(this).parent(".header-nav__item.dropdown").find(".header-flyout").first();
    if ($itemSubmenu.length > 0 && $(this).hasClass("show")) adjustFlyoutPosition($itemSubmenu);
  });

  // first level submenu > on hover event
  $('.header-nav__anchor[data-event="hover"]').on("mouseenter", function () {
    const $itemSubmenu = $(this).parent(".header-nav__item.dropdown").find(".header-flyout").first();
    if ($itemSubmenu.length > 0 && $(this).hasClass("show")) adjustFlyoutPosition($itemSubmenu);
  });

  // deeper levels > on click event
  $('.header-flyout__link--has-dropdown[data-event="click"]').on("click", function () {
    const $itemSubmenu = $(this).parent(".header-flyout__item").find(".header-flyout").first();
    if ($itemSubmenu.length > 0 && $(this).hasClass("show")) adjustFlyoutPosition($itemSubmenu);
  });

  // deeper levels > on hover event
  $('.header-flyout__link--has-dropdown[data-event="hover"]').on("mouseenter", function () {
    const $itemSubmenu = $(this).parent(".header-flyout__item").find(".header-flyout").first();
    if ($itemSubmenu.length > 0) adjustFlyoutPosition($itemSubmenu);
  });
}

function cycleProductBlockImagesOnHover() {
  $(".product-block__picture--overlap").each(() => {
    const imageParent = $(this).parents(".product-block");
    const imageOriginal = $(this).attr("data-image-original");
    const imageHover = $(this).attr("data-image-hover");
    const imageSource = $(this).find("source");

    imageParent
      .on("mouseenter", () => imageSource.attr("srcset", imageHover))
      .on("mouseleave", () => imageSource.attr("srcset", imageOriginal));
  });
}

function handleProductVideoEmbed() {
  const videos = document.querySelectorAll("[data-youtube]");
  if (videos.length === 0) return;

  videos.forEach((video) => {
    try {
      const url = new URL(video.href);
      const id = url.searchParams.get("v");
      if (id) {
        video.setAttribute("data-youtube", id);
        video.setAttribute("role", "button");
        video.innerHTML = `<img src="https://img.youtube.com/vi/${id}/maxresdefault.jpg"><br>${video.textContent}`;
      }
    } catch (error) {
      console.error("Invalid video URL", error);
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-youtube]");
    if (link) {
      event.preventDefault();
      const id = link.getAttribute("data-youtube");
      const player = document.createElement("div");
      player.innerHTML = `<iframe width="100%" height="auto" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      link.replaceWith(player);
    }
  });
}

function initializeProductPage() {
  const moveProductPageContentBetweenMobileAndDesktop = () => {
    if ($(".product-page .mobile-first").length === 0 || window.theme.template !== "product") return;

    const isMobile = $(window).width() < 768;
    const $productPage = $(".product-page");
    const $productInfo = $productPage.find(".product-page__info");
    const $productGalleryWrapper = $productPage.find(".product-gallery__wrapper");
    const $itemsToMove = $productPage.find(".product-page__info .mobile-first");

    if ($productPage.find(".product-heading").length === 0)
      $("<div>", { class: "product-heading" }).append($itemsToMove).appendTo($productPage);
    const $productHeading = $productPage.find(".product-heading");

    if (isMobile) $productHeading.insertBefore($productGalleryWrapper);
    else $productHeading.insertBefore($productInfo);
  };

  const productPageZoomLensOnImageHover = () => {
    $(".product-gallery").each(function () {
      const isMobile = $(window).width() < 768;
      const enableZoom = $(".product-gallery__wrapper", this).attr("data-zoom") === "true";
      if (enableZoom && !isMobile) {
        $(".product-gallery__zoom-icon", this).show();
        $(this)
          .find(".product-gallery__image--hidden")
          .each(function () {
            const imageUrl = $(this).attr("src");
            if (imageUrl) $(this).closest(".zoom").zoom({ url: imageUrl });
          });
      } else {
        $(".product-gallery__zoom-icon", this).hide();
      }
    });
  };

  const productPageDescriptionToggle = () => {
    if ($('.product-page__body[data-collapse="true"]').length === 0) return;
    $('.product-page__body[data-collapse="true"]').each(function () {
      const descriptionHeight = parseFloat($(this).height());
      const descriptionThreshold = parseFloat($(this).data("collapse-threshold"));
      const descriptionToggle = $(".product-page__toggle");
      if (descriptionHeight >= descriptionThreshold) {
        $(this).addClass("product-page__body--collapse");
        descriptionToggle.removeClass("hidden");
      } else {
        $(this).removeClass("product-page__body--collapse");
        descriptionToggle.addClass("hidden");
      }
      descriptionToggle.on("click", function () {
        $(this)
          .parents(".product-page__description")
          .find(".product-page__body")
          .toggleClass("product-page__body--collapse");
        $(this).toggleClass("active");
      });
    });
  };

  $('[id*="product-template-"]').each(function () {
    const productPageId = `#${$(this).attr("id")}`;
    dynamicProductFormListener(productPageId, false);
  });
  productPageZoomLensOnImageHover();
  productPageDescriptionToggle();
  handleProductVideoEmbed();
  moveProductPageContentBetweenMobileAndDesktop();
  $(window).on("resize", moveProductPageContentBetweenMobileAndDesktop);
}

function initializeSelectedProduct() {
  $('[id*="selected-product-"]').each(function () {
    const selectedProductId = `#${$(this).attr("id")}`;
    dynamicProductFormListener(selectedProductId, true);
  });
}

function initializeProductBlockInputs() {
  document.querySelectorAll(".product-block__input").forEach((input) => {
    const price = +input.getAttribute("data-price");
    const minQuantity = +input.getAttribute("data-min");

    checkQuantityProductBlock(input);
    checkBuyNowProductBlock(input, price, minQuantity);
    input.addEventListener("change", function () {
      checkQuantityProductBlock(this);
      checkBuyNowProductBlock(this, price, minQuantity);
    });
  });
}

function applyClassNamesForStyling() {
  $("input.invalid").addClass("is-invalid");
  $("#contact_form .button").addClass("button--style button--main");
  $("#submit_login ").addClass("button--style button--secondary");
  $("<a>", {
    href: I18N.customer_register_back_link_url,
    title: I18N.customer_register_back_link_text,
    text: I18N.customer_register_back_link_text,
  }).appendTo(".customer-form:not(.customer-form--details) #details .actions");
  $(".customer-form form .actions .button").addClass("button--style button--main");
  $(".customer-form form div.error").addClass("alert alert-danger");
  $(".customer-form form div.notice").addClass("alert alert-primary");
  $(".customer-form form div.warning").addClass("alert alert-warning");

  $("figure iframe").parent("figure").addClass("video-wrapper");
  $(".theme-section__body table").addClass("table table-bordered theme-table");
  $(".theme-section__body table").each(() => $(this).wrap('<div class="table-responsive"></div>'));

  $(".cart-page #credentials").find("#submit_password").addClass("button--style button--secondary");
  $("input#estimate_shipping_postal").addClass("text");
  $("#estimate_shipping_button").addClass("w-100");
  $("#estimate_shipping_button, #set_shipping_button").addClass("button button--style button--secondary button--small");
  const estimateResultsForm = $("#estimate_shipping_results");
  if (estimateResultsForm.is(":visible")) {
    $("#estimate_shipping_button").parents(".estimate_shipping_buttons").hide();
    $("#estimate_shipping_form .select").on("change", function () {
      estimateResultsForm.hide();
      $("#estimate_shipping_button").parents(".estimate_shipping_buttons").show();
    });
  }
}

function replaceCartButtonWithAnchorToCart() {
  if (document.querySelector("cart-area")) {
    $("#sidebar-cart")?.offcanvas("hide");
    return;
  }
  const cartButton = document.querySelector(`.button.dropdown-toggle.header__link[data-bs-target="#sidebar-cart"]`);
  if (cartButton) {
    const cartButtonLink = document.createElement("a");
    cartButtonLink.href = "/cart";
    cartButtonLink.classList.add("button", "header__link");
    cartButtonLink.innerHTML = cartButton.innerHTML;
    cartButton.replaceWith(cartButtonLink);
  }
}
function filtersDirectClick() {
  const form = document.getElementById("filters-form");

  if (!form || form.dataset.behavior !== "true") return;

  form.addEventListener("click", function (event) {
    if (window.innerWidth > 767) {
      const target = event.target;
      if (target.classList.contains("theme-filters__checkbox")) {
        form.submit();
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", filtersDirectClick);

function filtersCountOnButton() {
  const filtersButton = $('.theme-section__heading .button[data-bs-target="#sidebar-filters"]');
  const filtersButtonLength = filtersButton.length;
  const filtersCount = $(".theme-filters__group > .theme-filters__tag:not(.theme-filters__tag--remove)").length;

  if (filtersButtonLength > 0 && filtersCount > 0) {
    filtersButton.append(" <span>(" + filtersCount + ")</span>");
  }
}

function applyProseStyles(rootSelector) {
  const $root = $(rootSelector);
  if ($root.length === 0) return;

  document.querySelectorAll("table").forEach((table) => table.classList.add("table", "table-bordered", "theme-table"));
  document.querySelectorAll("li").forEach((li) => {
    const content = li.innerHTML.trim();
    if (content.startsWith("[x]") || content.startsWith("[]") || content.startsWith("[ ]")) {
      const isChecked = content.startsWith("[x]");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isChecked;
      checkbox.disabled = true;
      checkbox.classList.add("me-2", "mt-1");
      li.innerHTML = content.substring(3).trim();
      li.insertBefore(checkbox, li.firstChild);
      li.classList.add("list-unstyled", "d-flex", "align-items-start");
      li.parentElement.classList.add("pl-0");
    }
  });
}

function setupStoreProductAddToCartButtons() {
  const buttons = document.querySelectorAll(".store-product__add-to-cart[type='button']");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const { productId, productName } = button.dataset;
      const actionUrl = button.closest(".store-product__form").getAttribute("action");
      const urlParams = new URLSearchParams(actionUrl.split("?")[1]);
      const qty = urlParams.get("qty") || 1;
      const options = {};
      urlParams.forEach((value, key) => {
        if (key !== "qty") options[key] = value;
      });

      addToCart(productId, productName, qty, options, "store-product", { id: productId });
    });
  });
}

jQuery(() => {
  console.info(`[${new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false })}] Loaded main.js`);

  adjustFlyoutSubmenusPosition();
  applyClassNamesForStyling();
  cycleProductBlockImagesOnHover();
  initializeProductPage();
  initializeSelectedProduct();
  initializeProductBlockInputs();
  replaceCartButtonWithAnchorToCart();
  filtersCountOnButton();
  applyProseStyles(".product-page__description");
  setupStoreProductAddToCartButtons();
});
