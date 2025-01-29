const I18N = window.theme.translations;
const OPTIONS = window.theme.options;
const IS_PREVIEW = window.theme.is_preview;

/* ----- Utilities ----- */
function localizedFetch(url, options) {
  if (typeof url !== "string" || !url.startsWith("/")) {
    return fetch(url, ...args);
  }

  // if the document language appears in the URL, add it to the fetch URL
  const lang = document.documentElement.lang;
  const locale = document.location.pathname.split("/")[1] || undefined;

  if (lang && lang === locale && !url.startsWith(`/${lang}`)) {
    url = `/${lang}${url}`;
  }

  // might be required in the future
  const previewToken = new URLSearchParams(window.location.search).get("preview");
  if (previewToken) {
    url = new URL(url, window.location.origin);
    url.searchParams.delete("preview");
    url.searchParams.append("preview", previewToken);
  }

  return fetch(url, options);
}

function openUrlInPopup(url, title = "Share", w = 640, h = 300) {
  return !window.open(url, title, `width=${w},height=${h}`);
}

function copyToClipboard(str, useAlert = false) {
  navigator.clipboard.writeText(str);
  console.info("Copied to clipboard:", str);
  if (useAlert)
    new ToastNotification({
      type: "success",
      title: I18N.success,
      message: `Copied to clipboard: <strong>${str}</strong>`,
    });
}

function smoothScrollToElement(selector) {
  const element = document.querySelector(selector);
  window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 200, behavior: "smooth" });
}

function updateFormAction(buttonElement, action_url) {
  const form = buttonElement.closest("form");
  form.action = action_url;
}

function productBlockBuyNow(buttonElement, actionUrl) {
  const productBlock = buttonElement.closest(".product-block");
  const form = productBlock.querySelector(".product-block__form");

  form.action = actionUrl;
  form.submit();
}

function formatTranslation(translation, args) {
  return translation.replace(/%\{([\d\w_-]+)\}/g, (_, key) => args[key]);
}

function formatAddedCartProduct(name, qty) {
  return formatTranslation(qty == 1 ? I18N.added_singular : I18N.added_qty_plural, { qty, name });
}

function canBuyNow({ minQuantity, quantity, price }) {
  const quantityFallback = quantity || document.querySelector(".product-form__quantity input#input-qty")?.value || 1;
  const minQuantityFallback = minQuantity || +document.querySelector("#input-qty")?.attributes["data-min"]?.value || 1;

  if (quantityFallback < minQuantityFallback) return false; // selected less than minimum quantity to buy individual product

  const conditionType = window.theme.order.minimumPurchase.conditionType;
  const conditionValue = +window.theme.order.minimumPurchase.conditionValue;
  switch (conditionType) {
    case "qty":
      return quantityFallback >= conditionValue;
    case "price":
      if (!price) {
        console.error("price is null in canBuyNow");
        return false;
      }
      return price * quantityFallback >= conditionValue;
    default:
      return true;
  }
}

/* ----- Add to cart ----- */
function addToCartNotification(productName, qty) {
  if (!OPTIONS.display_cart_notification) return;
  const productNameBold = `<strong>${productName}</strong>`;
  const cartLink = $("#cart-link").attr("href") || "/cart";
  new ToastNotification({
    type: "success",
    title: I18N.success_adding_to_cart,
    message: `<span class="d-block">${formatAddedCartProduct(productNameBold, qty)}</span>
      <a href="${cartLink}" class="toast-notification__link">${I18N.go_to_shopping_cart}</a>`,
  });
}

async function normalAddToCartCallback(data, productName, qty) {
  if (data.status && data.status != 200) {
    return new ToastNotification({
      type: "error",
      title: I18N.error_adding_to_cart,
      message: data.responseJSON.message,
    });
  }

  const isCartEmpty = $("#sidebar-cart").length === 0;
  if (isCartEmpty) addToCartNotification(productName, qty);
  else {
    const prevProductsCount = +$(".header__text--counter").text();
    const productsCount = data.products_count;
    await refreshCartDisplay();
    $(".header__text--counter").text(productsCount);

    if (prevProductsCount === 0) $("#sidebar-cart").offcanvas("show");
    else addToCartNotification(productName, qty);
  }
}

async function storeProductAddToCartCallback(data, productName, qty, productId) {
  if (data.status && data.status != 200) {
    return new ToastNotification({
      type: "error",
      title: I18N.error_adding_to_cart,
      message: data.responseJSON.message,
    });
  }

  await refreshCartDisplay();
  const csp = document.querySelector(`.cross-selling-products .store-product[data-id="${productId}"]`);
  if (!csp) {
    const productsCount = data.products_count;
    if (productsCount === 1) $("#sidebar-cart").offcanvas("show");
    else addToCartNotification(productName, qty);

    return;
  }

  csp.remove();
  const csps = document.querySelector(".cross-selling-products");
  if (csps.children.length === 0) csps.closest(".theme-section").classList.add("hidden");
}

function addToCart(id, productName, qty, options, callbackSource = "normal", callbackParams = {}) {
  const cartArea = document.querySelector("cart-area");
  if (cartArea) cartArea.setIsLoading(true);
  qty = parseInt(qty);
  Jumpseller.addProductToCart(id, qty, options, {
    callback: function (data) {
      if (cartArea) cartArea.setIsLoading(false);
      switch (callbackSource) {
        case "normal":
          normalAddToCartCallback(data, productName, qty);
          break;
        case "store-product":
          storeProductAddToCartCallback(data, productName, qty, callbackParams?.id);
          break;
        default:
          break;
      }
    },
  });
}

function addMultipleToCart(products, productNames) {
  Jumpseller.addMultipleProductsToCart(products, {
    callback: async function (data) {
      if (data.status && data.status != 200) {
        return new ToastNotification({
          type: "error",
          title: I18N.error_adding_to_cart,
          message: data.responseJSON.message,
        });
      }

      await refreshCartDisplay();
      const isCartEmpty = $("#sidebar-cart").length === 0;
      if (isCartEmpty) addToCartNotification(productName, qty);
      else {
        const prevProductsCount = +$(".header__text--counter").text();
        const productsCount = data.products_count;
        $(".header__text--counter").text(productsCount);

        if (prevProductsCount === 0) $("#sidebar-cart").offcanvas("show");
        else {
          const cartLink = $("#cart-link").attr("href") || "/cart";
          const joinedProductsMsg = products
            .map((prod, index) => formatAddedCartProduct(productNames[index], prod[1]))
            .join("<br>");

          new ToastNotification({
            type: "success",
            title: I18N.success_adding_to_cart,
            message: `<span class="d-block">${joinedProductsMsg}</span>
             <a href="${cartLink}" class="toast-notification__link">${I18N.go_to_shopping_cart}</a>`,
          });
        }
      }
    },
  });
}

async function refreshCartDisplay() {
  const cart = document.querySelector("cart-area");
  if (!cart) return;

  cart.setIsLoading(true);

  try {
    const response = await fetch("/?sections=header");
    if (!response.ok) return;

    const header = await response.text();
    const dom = new DOMParser().parseFromString(header, "text/html");

    const fetchedCart = dom.querySelector("cart-area");

    if (!fetchedCart) return;

    const cartEmpty = !dom.querySelector("#sidebar-cart.has-items");
    const template = window.theme.template;

    const setInnerHTML = (docEl, sectionEl) => {
      if (docEl && sectionEl) docEl.innerHTML = sectionEl.innerHTML;
    };

    if (template === "cart") {
      if (cartEmpty) {
        if (!document.querySelector(".theme-message")) location.reload();
        return;
      }

      setInnerHTML(
        document.querySelector(".store-totals__content"),
        fetchedCart.querySelector(".store-totals__content"),
      );
      setInnerHTML(
        document.querySelector(".cart-area__content .row"),
        fetchedCart.querySelector(".sidebar-body__content"),
      );

      document
        .querySelectorAll(".store-product:not(.col-md-6)")
        .forEach((product) => product.classList.add("col-md-6"));

      cart.setupEventHandlers();
    } else {
      document.querySelector("cart-area").replaceWith(fetchedCart);
      setInnerHTML(document.querySelector(".header__text--counter"), dom.querySelector(".header__text--counter"));
    }
  } catch (error) {
    console.error(error);
  } finally {
    cart.setIsLoading(false);
  }
}

function addToCartProductBlock(target) {
  const block = $(target).closest(".product-block");
  const input = block.find("form .product-block__quantity input");
  if (block.length !== 1 || input.length !== 1) return;
  const id = +block.attr("data-product-id");
  const name = block.find(".product-block__name").text();
  const qty = +input.val() || 1;
  addToCart(id, name, qty, {});
}

/* ----- Handle Inputs ----- */
function checkQuantityProductBlock(target) {
  const input = $(target);
  const value = parseInt(input.val(), 10);
  const minimum = parseInt(input.attr("min"), 10) || 1;
  const maximum = parseInt(input.attr("max"), 10) || Infinity;
  const clampedValue = Math.max(minimum, Math.min(value, maximum));
  if (clampedValue !== value) input.val(clampedValue);
}

function changeQuantityProductBlock(target, delta) {
  const block = $(target).closest(".product-block");
  const input = block.find("form .product-block__quantity input");
  if (block.length !== 1 || input.length !== 1) return;
  const value = +input.val();
  const minimum = input.is("[min]") ? +input.attr("min") : 1;
  const maximum = input.is("[max]") ? +input.attr("max") : Infinity;
  const newValue = Math.max(minimum, Math.min(value + delta, maximum));
  input.val(newValue);

  const minusButton = block.find(".product-block__handler.quantity-down");
  const plusButton = block.find(".product-block__handler.quantity-up");
  const maximumToBuy = parseFloat(input.attr("data-max")) || Infinity;

  minusButton.prop("disabled", newValue <= 1);
  plusButton.prop("disabled", newValue >= maximumToBuy);
}

function checkBuyNowProductBlock(target) {
  const block = $(target).closest(".product-block");
  const input = block.find("form .product-block__quantity input");
  if (block.length !== 1 || input.length !== 1) return;

  const price = +input.attr("data-price");
  const minQuantity = +input.attr("data-min");
  const value = +input.val();
  const canBuy = canBuyNow({
    quantity: value,
    minQuantity: minQuantity,
    price: price,
  });

  const buyNowButton = block.find(".product-block__buy-now");
  buyNowButton.prop("disabled", !canBuy);
  buyNowButton.text(canBuy ? I18N.buy_now : I18N.buy_now_not_allowed);
}

function updateProductFormCounter(target, delta) {
  const productForm = $(target).closest(".product-form");
  const quantityInput = productForm.find("input#input-qty");
  if (productForm.length !== 1 || quantityInput.length !== 1) return;

  const price = document.querySelector("product-price").price;
  const value = +quantityInput.val();
  const minimum = quantityInput.is("[min]") ? +quantityInput.attr("min") : 1;
  const maximum = quantityInput.is("[max]") ? +quantityInput.attr("max") : Infinity;
  const newValue = Math.max(minimum, Math.min(value + delta, maximum));
  quantityInput.val(newValue);

  const minusButton = productForm.find(".product-form__handler.quantity-down");
  const plusButton = productForm.find(".product-form__handler.quantity-up");
  const minimumToBuy = quantityInput.is("[data-min]") ? +quantityInput.attr("data-min") : 1;
  const maximumToBuy = parseFloat(quantityInput.attr("data-max")) || Infinity;
  const maxStock = parseInt(quantityInput.attr("max")) || Infinity;

  minusButton.prop("disabled", newValue <= 1);
  plusButton.prop("disabled", newValue >= maximumToBuy || newValue >= maxStock);
  plusButton.attr("max", Math.min(maximumToBuy, maxStock));

  const $buyNowButton = $("#buy-now-button");
  if ($buyNowButton) {
    const canBuy = canBuyNow({
      quantity: newValue,
      minQuantity: minimumToBuy,
      price: price,
    });
    $buyNowButton.prop("disabled", !canBuy);
    $buyNowButton.text(canBuy ? I18N.buy_now : I18N.buy_now_not_allowed);
  }
}

function addToWishlist(target, url) {
  event.preventDefault();
  Jumpseller.addProductToWishlist(url, {
    callback: function (data) {
      if ((data.status && data.status == "rejected") || data.warning) {
        new ToastNotification({
          type: "error",
          title: I18N.error_adding_to_wishlist,
          message: data.message,
        });
        return;
      }
      const element = $(target).closest(".product-wishlist").get(0);
      element.updateIcon(true);
      if (element.variants) {
        const variant = element.variants.find((x) => x.variant_id === data.product.variant_id);
        variant.wishlisted = true;
      } else {
        element.product.wishlisted = true;
      }

      const prevProductsCount = $(".header__wishlist--counter").text();
      $(".header__wishlist--counter").text(parseInt(prevProductsCount) + 1);

      const wishlistLink = "/customer/?target=wishlist";
      const productNameBold = `<strong>${data.product.name}</strong>`;
      new ToastNotification({
        type: "success",
        title: I18N.success_adding_to_wishlist,
        message: `<span class="d-block">${formatTranslation(I18N.added_to_wishlist, { name: productNameBold })}</span>
         <a href="${wishlistLink}" class="toast-notification__link">${I18N.go_to_wishlist}</a>`,
      });
    },
  });
}

function removeFromWishlistCustomer(target, url) {
  event.preventDefault();
  Jumpseller.removeProductFromWishlist(url, {
    callback: function (data) {
      if (data.status && data.status != 200) {
        return;
      }
      location.reload();
    },
  });
}

function removeFromWishlist(target, url) {
  event.preventDefault();
  Jumpseller.removeProductFromWishlist(url, {
    callback: function (data) {
      if ((data.status && data.status == "rejected") || data.warning) {
        new ToastNotification({
          type: "error",
          title: I18N.error_removing_from_wishlist,
          message: data.message,
        });
        return;
      }
      const element = $(target).closest(".product-wishlist").get(0);
      element.updateIcon(false);

      if (element.variants) {
        const variant_element = element.variants.find((variant) => variant.variant_id === data.product.variant_id);
        variant_element.wishlisted = false;
      } else {
        element.product.wishlisted = false;
      }

      const prevProductsCount = $(".header__wishlist--counter").text();
      $(".header__wishlist--counter").text(parseInt(prevProductsCount) - 1);

      const wishlistLink = "/customer/?target=wishlist";
      const productNameBold = `<strong>${data.product.name}</strong>`;
      new ToastNotification({
        type: "success",
        title: I18N.success_removing_from_wishlist,
        message: `<span class="d-block">${formatTranslation(I18N.removed_from_wishlist, { name: productNameBold })}</span>
         <a href="${wishlistLink}" class="toast-notification__link">${I18N.go_to_wishlist}</a>`,
      });
    },
  });
}

function checkMaxQuantityReached(firstCall = false) {
  const $inputQty = $("input#input-qty");
  const quantitySelected = +$inputQty.val();
  const maxQuantityToBuy = $inputQty.attr("data-max") ? +$inputQty.attr("data-max") : null;
  const maxQuantity = +$inputQty.attr("max");
  const $maxStockDisclaimer = $(".product-form__text--max-stock-disclaimer");

  if (maxQuantityToBuy && quantitySelected >= maxQuantityToBuy) $inputQty.val(maxQuantityToBuy);
  else if (quantitySelected >= maxQuantity) {
    if (!firstCall) $maxStockDisclaimer.removeClass("hidden");
    $inputQty.val(maxQuantity);
  } else {
    $maxStockDisclaimer.addClass("hidden");
  }

  const productForm = document.querySelector("product-form.product-form");
  if (!productForm) return;

  if (quantitySelected === 0 || productForm.getIsOutOfStock()) $maxStockDisclaimer.addClass("hidden");
}

function addQuantityVerifyListener() {
  document
    .querySelectorAll(".product-form__handler.quantity-up, .product-form__handler.quantity-down")
    .forEach((qty) => qty.addEventListener("click", () => checkMaxQuantityReached()));
}

function addVariantIdToUrl(variantId) {
  if (!variantId) return;
  const url = new URL(window.location.href);
  url.searchParams.set("variant_id", variantId);
  window.history.pushState({}, "", url);
}

function getVariantIdFromUrl() {
  const url = new URL(window.location.href);
  return +url.searchParams.get("variant_id");
}

const productFormListeners = new Set();

/**
 * @description Add a dynamic variant listener to a product form. The product json should be placed in a script.product-json element inside the root. First section of this function declares a sequence of local functions that are used to rebuild the product html upon variant change.
 * @param {String} root the root unique selector of the product form.
 * @param {Boolean} isSelectedProduct whether the listener is for a selected product, false by default
 * @param {Number} firstVariant the first variant to select, null by default
 */
function dynamicProductFormListener(root, isSelectedProduct = false, firstVariant = null) {
  let firstCallback = true;

  const rebuildAttributesComponent = (productInfo) => {
    const productAttributes = document.querySelector(`${root} product-attributes`);
    if (productAttributes) productAttributes.buildProductAttributes(productInfo);
  };

  const rebuildPriceComponent = (productInfoId) => {
    const productPrice = document.querySelector(`${root} product-price`);
    if (productPrice) productPrice.buildProductPrice(productInfoId);
  };

  const rebuildStockComponent = (productInfo) => {
    const productStock = document.querySelector(`${root} product-stock`);
    if (productStock) productStock.buildStock(productInfo);
  };

  const rebuildProductFormComponent = (productInfo) => {
    const productForm = document.querySelector(`${root} product-form`);
    if (productForm) productForm.buildProductForm(productInfo);
  };

  const rebuildStockLocationsComponent = (variantId) => {
    const productStockLocations = document.querySelector(`${root} product-stock-locations`);
    if (productStockLocations) productStockLocations.buildStockLocations(variantId);
  };

  const rebuildWishlistComponent = (productInfo) => {
    const productWishlist = document.querySelector(`${root} product-wishlist`);
    if (productWishlist) productWishlist.buildWishlist(productInfo);
  };

  const updateGalleryImage = (imageId) => {
    const gallery = document.querySelector(`${root} .product-gallery__carousel--main`);
    if (gallery) {
      const index = $(`${root} .swiper-slide img[src*="image/${imageId}"]`, gallery)
        .first()
        .closest(".swiper-slide")
        .index();
      gallery.swiper.slideTo(index >= 0 ? index : 0);
    }
  };

  const setSelectedVariant = (values) => {
    for (const { value } of values) {
      $(`${root} .variants [value="${value.id}"]`).each(function () {
        $(this).is("input")
          ? $(this).prop("checked", true).trigger("change")
          : $(this).prop("selected", true).trigger("change");
      });
    }
  };

  const selectVariantFromUrlOrFirstOptionInStock = () => {
    if (!Array.isArray(productOrVariants)) return;

    const listener = [...productFormListeners].find((x) => x.selector === root);
    if (listener && !listener.isSelectedProduct) {
      const variantId = getVariantIdFromUrl();
      if (variantId > 0) {
        const variantMatch = productOrVariants.find((p) => p.variant.id == variantId);
        if (variantMatch) return setSelectedVariant(variantMatch.values);
      }
    }

    if (firstVariant > 0) return setSelectedVariant(productOrVariants.find((p) => p.variant.id == firstVariant).values);

    for (const item of productOrVariants) {
      const variant = item.variant;
      if (variant.stock_unlimited || variant.stock > 0) return setSelectedVariant(item.values);
    }
  };

  const updateCustomFields = (customFields) => {
    $(`${root} .product-details__row--variant-only`).addClass("hidden"); // Hide all variant-specific CFVs
    Object.values(customFields || []).forEach((cfv) => {
      $(`${root} .product-details__row--variant-only:has(.product-details__value[data-cfvid=${cfv.id}])`).removeClass(
        "hidden",
      ); // Show all variant-specific CFVs for this variant
    });
  };

  const updateVariantsAvailability = (productInfo) => {
    $(`${root} .variants`).find("option, input, button:has(input)").removeClass("disabled");
    const entry = productOrVariants.find((item) => item.variant.id == productInfo.id);
    const values = entry.values.map((v) => v.value.id);
    const variants = productOrVariants.filter(
      (item) =>
        item.variant.stock == 0 &&
        !item.variant.stock_unlimited &&
        item.values.filter((val) => values.includes(val.value.id)).length == values.length - 1,
    );

    if (productInfo.stock == 0 && !productInfo.stock_unlimited) variants.push(entry);

    variants.forEach((variant) => {
      const ids = variant.values.map((v) => v.value.id).filter((id) => !values.includes(id));
      if (variant.variant.id == productInfo.id) ids.push(...variant.values.map((v) => v.value.id));
      ids.forEach((id) =>
        $(`${root} .variants`)
          .find(`option[value="${id}"], input[value="${id}"], button:has(input[value="${id}"])`)
          .addClass("disabled"),
      );
    });
  };

  const checkUploads = () => {
    const uploads = $(`${root} product-option__file-upload`);
    const inputSizes = new Array(uploads.length).fill(0); // track sizes

    $(`${root} .variants input[type="file"]`).each(function (index) {
      $(this).change(function () {
        inputSizes[index] = this.files[0].size;
        const totalSize = inputSizes.reduce((a, b) => a + b, 0);
        const inputFilename = document.getElementById(this.id + "_filename");
        if (totalSize <= 10485760) inputFilename.value = this.files[0].name;
        else {
          new ToastNotification({
            type: "error",
            title: I18N.error,
            message: I18N.files_too_large,
          });
          inputSizes[index] = 0;
          this.value = "";
          inputFilename.value = "";
        }
      });
    });
  };

  const getProductOptions = () => {
    const options = {};
    document.querySelectorAll(`${root} .prod-options`).forEach((opt) => {
      const optionId = opt.getAttribute("data-optionid");
      const isSelect = opt.querySelector("input") !== null;
      options[optionId] = isSelect ? opt.querySelector(":checked")?.value : opt?.value;
    });

    return options;
  };

  const productJson = $(`${root} script.product-json`);
  if (productJson.length === 0) return;

  const productId = +productJson.attr("data-productid");
  const productOrVariants = JSON.parse(productJson.get(0).textContent);

  if ([...productFormListeners].some((x) => x.selector === root)) return;
  productFormListeners.add({
    selector: root,
    productId,
    isSelectedProduct,
  });

  console.info(`Listening to product variant changes at ${root} (${productOrVariants.length} variants)`);

  $(`${root} button#add-to-cart[type=button]`).on("click", () => {
    const name = $(`${root} .product-page__title`).text();
    const qty = $(`${root} .product-form__input`).val() || 1;
    const options = getProductOptions();
    addToCart(productId, name, qty, options);
  });

  const callbackFunction = (_event, productInfo) => {
    if ($.isEmptyObject(productInfo)) return; // no variants for this product

    if (window.lastVariantId !== productInfo.id) {
      window.lastVariantId = productInfo.id;
      firstCallback = true;
    }

    const listener = [...productFormListeners].find((x) => x.selector === root);
    if (listener && !listener.isSelectedProduct) {
      addVariantIdToUrl(productInfo.id);
    }

    updateCustomFields(productInfo.custom_fields);
    updateVariantsAvailability(productInfo);
    updateGalleryImage(+productInfo.image_id);

    rebuildAttributesComponent(productInfo);
    rebuildPriceComponent(productInfo.id);
    rebuildStockComponent(productInfo);
    rebuildProductFormComponent(productInfo);
    rebuildStockLocationsComponent(productInfo.id);
    rebuildWishlistComponent(productInfo.id);

    addQuantityVerifyListener();
    checkMaxQuantityReached(firstCallback);

    firstCallback = false;
  };

  Jumpseller.productVariantListener(`${root} select.prod-options, ${root} fieldset.product-options__fieldset`, {
    product: productOrVariants,
    callback: callbackFunction,
  });

  selectVariantFromUrlOrFirstOptionInStock();
  addQuantityVerifyListener();
  checkMaxQuantityReached(true);
  checkUploads();
}

/* ------------ Custom Elements ------------ */
class CustomHTMLElement extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialize();
    this.initialized = true;
  }

  initialize() {}
}

class ShareComponent extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.buildShare();
  }

  buildShare() {
    const data = JSON.parse(this.querySelector(`script.share-json`).textContent);
    const options = data.options;
    const item = data.info.product || data.info.page;
    const isProduct = !!data.info.product;

    let sharingHtml = "";
    if (options.showFacebook) sharingHtml += this.#getShareHTML(item, "facebook");
    if (options.showTwitter) sharingHtml += this.#getShareHTML(item, "twitter");
    if (options.showWhatsapp) sharingHtml += this.#getShareHTML(item, "whatsapp");
    if (options.showEmail) sharingHtml += this.#getShareHTML(item, "email");
    if (options.showPinterest) sharingHtml += this.#getShareHTML(item, "pinterest", isProduct);
    if (options.showClipboard) sharingHtml += this.#getShareHTML(item, "clipboard");
    sharingHtml += this.#getGeneralShareHTML(item, data.info.title);

    $(".theme-share", this).html(sharingHtml);
    this.handleNativeShare(item, isProduct ? null : data.info.sectionId);
  }

  handleNativeShare(item, sectionId) {
    const topmost = sectionId ? $(`#${sectionId}`) : $(this);
    const shareTitle = topmost.find(".theme-section__title, .product-page__subtitle");
    const shareLink = topmost.find(".theme-share__link");
    const shareButton = topmost.find(".theme-share__button");

    if (navigator.share && window.innerWidth < 768) {
      shareTitle.addClass("hidden");
      shareLink.addClass("hidden");
      shareButton.removeClass("hidden");

      shareButton.on("click", function () {
        navigator
          .share({
            title: item.name || item.title,
            url: item.url,
          })
          .then(() => {
            console.info(`${item.name || item.title} successfully shared.`);
          })
          .catch(console.error);
      });
    } else {
      shareTitle.removeClass("hidden");
      shareLink.removeClass("hidden");
      shareButton.addClass("hidden");
    }
  }

  #getShareHTML(item, platform, isProduct = true) {
    const shareConfigs = {
      facebook: {
        url: `https://www.facebook.com/share.php?u=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.name || item.title)}`,
        icon: "ph-facebook-logo",
        title: "Facebook",
        action: "popup",
      },
      twitter: {
        url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(item.url)}&text=${encodeURIComponent(item.name || item.title)}`,
        icon: "ph-x-logo",
        title: "𝕏",
        action: "popup",
      },
      whatsapp: {
        url: `https://api.whatsapp.com/send?text=${I18N.check_this}%20${encodeURIComponent(item.name || item.title)}%20${encodeURIComponent(item.url)}`,
        icon: "ph-whatsapp-logo",
        title: "WhatsApp",
        action: "popup",
      },
      pinterest: {
        url: this.#getPinterestUrl(item, isProduct),
        icon: "ph-pinterest-logo",
        title: "Pinterest",
        action: "popup",
      },
      email: {
        url: `mailto:?subject=${encodeURIComponent(item.name || item.title)}&body=${encodeURIComponent(item.url)}`,
        icon: "ph-envelope-simple",
        title: "Email",
        action: "direct",
      },
      clipboard: {
        url: item.url,
        icon: "ph-link",
        title: I18N.copy_to_clipboard,
        action: "clipboard",
      },
    };

    const config = shareConfigs[platform];

    let onClickAction;
    switch (config.action) {
      case "popup":
        onClickAction = `openUrlInPopup('${config.url}')`;
        break;
      case "direct":
        onClickAction = "";
        break;
      case "clipboard":
        onClickAction = `copyToClipboard('${config.url}', true)`;
        break;
      default:
        onClickAction = "";
    }

    return `<button
      type="button"
      ${onClickAction ? `onclick="${onClickAction}"` : ""}
      ${config.action === "direct" ? `href="${config.url}"` : ""}
      title="${config.action === "clipboard" ? config.title : `${I18N.share_on} ${config.title}`}"
      class="button theme-share__link"
    >
      <i class="theme-icon ph ${config.icon}"></i>
    </button>`;
  }

  #getPinterestUrl(item, isProduct) {
    const getDescription = (text) => (text ? text.replace(/'/g, "") : "");
    const description = isProduct
      ? [getDescription(item.name), getDescription(item.description)]
      : [getDescription(item.title), getDescription(item.body)];

    const descriptionText = description.filter(Boolean).join(" - ");
    const imageContent = item.image ? `media=${encodeURIComponent(item.image)}&` : "";
    return `https://pinterest.com/pin/create/bookmarklet/?${imageContent}url=${encodeURIComponent(item.url || "")}&is_video=false&description=${encodeURIComponent(descriptionText)}`;
  }

  #getGeneralShareHTML(item, title) {
    return `<button
      type="button"
      class="button button--style button--secondary button--bordered theme-share__button"
    >
      <i class="theme-icon ph ph-share-network"></i>
      <span>${title}</span>
    </button>`;
  }
}
window.customElements.define("share-component", ShareComponent);

class NewsletterForm extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.success = this.getAttribute("fn-success") || I18N.newsletter_message_success;
    this.failure = this.getAttribute("fn-failure") || I18N.newsletter_message_error;
    this.placeholder = this.getAttribute("fn-email-placeholder") || I18N.newsletter_text_placeholder;
    this.buttonText = this.getAttribute("fn-button-text") || I18N.newsletter_text_button;
    this.buttonClass = this.getAttribute("fn-button-class");
    const form = $(this).find("form");
    if (form.length > 0) {
      this.#extendBaseForm(form);
      this.#boostForm(form.get(0));
      form.prop("role", null);
    }
  }

  #extendBaseForm(form) {
    $(this).is(".footer-newsletter") ? this.#extendFooterForm(form) : this.#extendComponentForm(form);
  }

  #extendFooterForm(form) {
    form.addClass("validate footer-newsletter__form");
    form.find(".newsletter_form_group").addClass("footer-newsletter__field");
    form
      .find("input[name='customer[email]']")
      .addClass("email footer-newsletter__input")
      .attr("placeholder", this.placeholder);
    form
      .find("button")
      .addClass("button button--main footer-newsletter__submit")
      .html('<i class="ph ph-paper-plane-right"></i>')
      .attr("aria-label", this.buttonText);
  }

  #extendComponentForm(form) {
    form.addClass("validate");
    form.find(".newsletter_form_group").addClass("theme-newsletter__wrapper");
    form.find("input[name='customer[email]']").addClass("email field text theme-newsletter__input");
    form.find("input[name='customer[email]']").attr("placeholder", this.placeholder);
    form.find("button").addClass(this.buttonClass).html(this.buttonText);
  }

  #boostForm(form) {
    form.addEventListener("jumpseller-captcha-validated", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      $.ajax({ method: "POST", url: form.action, data: formData, processData: false, contentType: false })
        .done(
          () =>
            new ToastNotification({
              type: "success",
              title: I18N.newsletter_message_success_captcha,
              message: this.success,
            }),
        )
        .fail(
          () =>
            new ToastNotification({
              type: "error",
              title: I18N.newsletter_message_error_captcha,
              message: this.failure,
            }),
        );
    });
  }
}
window.customElements.define("newsletter-form", NewsletterForm);

class InstagramFeed extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.#loadInstagramPosts();
  }

  #loadInstagramPosts() {
    const limit = +this.getAttribute("ig-limit");
    const xhr = new XMLHttpRequest();
    const container = this;
    xhr.open("GET", `/instagram-app/media?count=${limit}`, true);
    xhr.onreadystatechange = function () {
      if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
        const json = JSON.parse(xhr.responseText);
        json.posts.slice(0, limit).forEach((post) => {
          const postClass = container.getAttribute("ig-class");
          const postTitle = container.getAttribute("ig-title");
          const postBlockImg = document.createElement("img");
          postBlockImg.className = "instagram-block__image";
          postBlockImg.src = post.thumbnail_url;
          postBlockImg.alt = post.caption?.substring(0, 80) | "";
          const postBlockIcon = document.createElement("i");
          postBlockIcon.className = "ph ph-instagram-logo";
          const postBlockText = document.createElement("div");
          postBlockText.innerText = `${postTitle}`;
          const postBlockOverlay = document.createElement("div");
          postBlockOverlay.className = "instagram-block__overlay trsn";
          postBlockOverlay.appendChild(postBlockIcon);
          postBlockOverlay.appendChild(postBlockText);
          const postBlockAnchor = document.createElement("a");
          postBlockAnchor.target = "_blank";
          postBlockAnchor.href = post.permalink;
          postBlockAnchor.title = postTitle;
          postBlockAnchor.className = "instagram-block__anchor";
          postBlockAnchor.appendChild(postBlockImg);
          postBlockAnchor.appendChild(postBlockOverlay);
          const postBlock = document.createElement("div");
          postBlock.className = `instagram-block ${postClass}`;
          postBlock.appendChild(postBlockAnchor);
          container.appendChild(postBlock);
        });
      }
    };
    xhr.send();
  }
}
window.customElements.define("instagram-feed", InstagramFeed);

class PopupAgeVerification extends CustomHTMLElement {
  constructor() {
    super();
    this.cookieName = "age-verification-verified";
    this.noRedirect = OPTIONS.av_popup_button_reject_redirect;
  }

  initialize() {
    this.#registerListeners();
    this.#verificationLoad();
  }

  #registerListeners() {
    this.querySelectorAll(".age-verification__button--accept").forEach((button) => {
      button.addEventListener("click", () => this.#confirm());
    });
    this.querySelectorAll(".age-verification__button--reject").forEach((button) => {
      button.addEventListener("click", () => this.#failed());
    });
  }

  #verificationLoad() {
    try {
      const agePass = this.#getCookie();
      agePass != "" ? this.#popupHide() : this.#popupShow();
    } catch (err) {
      this.#popupShow();
    }
  }

  #setCookie(cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = this.cookieName + "=" + cvalue + ";" + expires + ";path=/";
  }

  #getCookie() {
    const name = this.cookieName + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == " ") c = c.substring(1);
      if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
  }

  #popupHide() {
    document.body.style.overflow = "auto";
    this.style.display = "none";
  }

  #popupShow() {
    document.body.style.overflow = "hidden";
    this.style.display = "block";
  }

  #confirm() {
    this.#setCookie("pop-up-verified", 365);
    this.#popupHide();
  }

  #failed() {
    window.location.replace(this.noRedirect);
  }
}
window.customElements.define("popup-age-verification", PopupAgeVerification);

class StoreWhatsapp extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.#showWhatsappMessage();
    this.closeButton = $(".store-whatsapp__close", this);
    this.closeButton.on("click", () => this.#closeWhatsappMessage());
  }

  #showWhatsappMessage() {
    const days = +this.getAttribute("box-cookie");
    const whatsappMessage = document.querySelector(".store-whatsapp__message");
    const closedAt = localStorage.getItem("whatsappMessageClosedAt");
    if (days == 0 || Number.isNaN(days)) whatsappMessage.style.display = "none";
    else if (whatsappMessage && !closedAt) whatsappMessage.style.display = "";
    else if (whatsappMessage && closedAt) {
      const now = new Date().getTime();
      const oneDay = days * 60 * 60 * 1000;
      if (now - closedAt >= oneDay) {
        whatsappMessage.style.display = "";
        localStorage.removeItem("whatsappMessageClosedAt");
      }
    }
  }

  #closeWhatsappMessage() {
    const whatsappMessage = document.querySelector(".store-whatsapp__message");
    if (whatsappMessage) {
      whatsappMessage.style.display = "none";
      localStorage.setItem("whatsappMessageClosedAt", new Date().getTime());
    }
  }
}
window.customElements.define("store-whatsapp", StoreWhatsapp);

class SwiperSlider extends CustomHTMLElement {
  constructor() {
    super();
    this.resizeObserver = null;
    this.handleResize = this.#updatePaginationType.bind(this);
    this.handleSectionSelect = this.#updateAutoplay.bind(this);
    this.handleSectionDeselect = this.#updateAutoplay.bind(this);
  }

  connectedCallback() {
    this.initialize();
    const spinnerWrapper = this.root.querySelector(".loading-spinner__wrapper");
    if (spinnerWrapper) {
      spinnerWrapper.remove();
    }
  }

  initialize() {
    const rootSelector = this.getAttribute("sw-root") || "[id^=component-]";
    this.root = this.closest(rootSelector) || this;
    this.section_id = this.closest("[id^=theme-section-]")?.id;
    this.layout = this.getAttribute("sw-layout");
    this.layoutType = this.getAttribute("sw-layout-type") || "multiple";
    this.items = this.querySelectorAll(".swiper-slide");
    this.columns = +this.getAttribute("sw-columns");
    this.columnsDesktop = +this.getAttribute("sw-columns-desktop") || this.columns || 1;
    this.columnsTablet = parseInt(this.getAttribute("sw-columns-tablet"), 10);
    this.columnsMobileUp = parseInt(this.getAttribute("sw-columns-mobile-up"), 10);
    this.columnsMobile = +this.getAttribute("sw-columns-mobile") || this.columns || 1;
    this.columnsMobileSmall = +this.getAttribute("sw-columns-mobile-small") || this.columns || 1;
    this.direction = this.getAttribute("sw-direction") || "horizontal";
    this.rewind = this.getAttribute("sw-rewind") !== "false";
    this.loop = this.getAttribute("sw-loop") === "true";
    this.freeMode = this.getAttribute("sw-free-mode") === "true";
    this.effect = this.getAttribute("sw-effect");
    this.observer = this.getAttribute("sw-observer") === "true";
    this.autoHeight = this.getAttribute("sw-auto-height") === "true";
    this.grab = this.getAttribute("sw-grab") === "true";
    this.autoplay = this.getAttribute("sw-autoplay") === "true";
    this.speed = this.getAttribute("sw-speed") || 1000;
    this.spaceBetween = 0;
    this.thumbnails = this.getAttribute("sw-thumbs");
    this.thumbnailsSlider = this.root.querySelector(".product-gallery__carousel--thumbs");
    this.thumbnailsDirection = this.getAttribute("sw-thumbs-direction");
    this.#initSwiper();
    this.#updatePaginationType(); // Ensure the pagination type is set correctly on initialization
    window.addEventListener("resize", this.handleResize); // Update on resize
    document.addEventListener("jumpseller:section:select", this.handleSectionSelect);
    document.addEventListener("jumpseller:section:deselect", this.handleSectionDeselect);
  }

  disconnectedCallback() {
    window[`swiperSlideIndex_${this.root.id}`] = this.swiper.activeIndex;
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("jumpseller:section:select", this.handleSectionSelect);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.swiper) {
      this.swiper.destroy();
    }
  }

  #updateAutoplay(event) {
    if (!this.autoplay) return;

    if (event.type === "jumpseller:section:select" && `theme-section-${event.detail.id}` === this.section_id) {
      this.swiper.autoplay.stop();
    } else if (event.type === "jumpseller:section:deselect" && `theme-section-${event.detail.id}` === this.section_id) {
      this.swiper.autoplay.start();
    } else {
      this.swiper.autoplay.start();
    }
  }

  #autoplay() {
    return this.autoplay ? { delay: this.speed, disableOnInteraction: false, pauseOnMouseEnter: true } : false;
  }

  #navigation() {
    const nextEl = this.root.querySelector(".swiper-button-next");
    const prevEl = this.root.querySelector(".swiper-button-prev");
    return nextEl && prevEl ? { nextEl, prevEl } : false;
  }

  #pagination() {
    const pagination = this.root.querySelector(".swiper-pagination");
    return pagination ? { el: pagination, clickable: true, type: "bullets" } : false; // Default type as 'bullets'
  }

  #updatePaginationType() {
    if (!this.swiper) return;

    const viewportWidth = window.innerWidth;
    const paginationType = viewportWidth < 768 ? "fraction" : "bullets";

    // Ensure pagination params is an object
    if (typeof this.swiper.params.pagination === "object") {
      this.swiper.params.pagination.type = paginationType;

      // Remove old pagination classes and add the new one
      if (this.swiper.pagination.el) {
        this.swiper.pagination.el.classList.remove("swiper-pagination-fraction", "swiper-pagination-bullets");
        this.swiper.pagination.el.classList.add(`swiper-pagination-${paginationType}`);
      }

      // Reinitialize the swiper pagination to apply changes
      this.swiper.pagination.init();
      this.swiper.pagination.render();
      this.swiper.pagination.update();
    }
  }

  #layout() {
    const layouts = {
      one: { slidesPerView: 1 },
      "top-bar": {
        slidesPerView: this.columns,
      },
      products: {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: this.columnsMobile },
          576: { slidesPerView: 2 },
          768: { slidesPerView: 3 },
          992: { slidesPerView: 4 },
          1200: { slidesPerView: this.columnsDesktop },
        },
      },
      "featured-category": {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: this.columnsMobile },
          414: { slidesPerView: this.columnsMobile },
          768: { slidesPerView: this.columnsMobileUp },
          992: { slidesPerView: this.columnsTablet },
          1200: { slidesPerView: this.columnsDesktop },
        },
      },
      slider: {
        slidesPerView: 1,
      },
      banners: {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: this.columnsMobileSmall },
          415: { slidesPerView: this.columnsMobile },
          576: { slidesPerView: this.columnsDesktop >= 2 ? 2 : 1 },
          768: { slidesPerView: this.columnsDesktop >= 3 ? 3 : this.columnsDesktop === 2 ? 2 : 1 },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      testimonials: {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: 1 },
          414: { slidesPerView: this.columnsMobile },
          768: { slidesPerView: 3 },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      "logo-gallery": {
        slidesPerView: 2,
        breakpoints: {
          0: { slidesPerView: 2 },
          415: { slidesPerView: this.columnsMobile },
          768: { slidesPerView: 3 },
          992: { slidesPerView: 4 },
          1200: { slidesPerView: this.columnsDesktop },
        },
      },
      "featured-reviews": {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: 1 },
          576: { slidesPerView: this.columnsDesktop >= 2 ? 2 : 1 },
          768: { slidesPerView: this.columnsDesktop >= 2 ? 2 : this.columnsDesktop === 2 ? 2 : 1 },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      "product-reviews": {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: 1 },
          576: { slidesPerView: this.columnsDesktop >= 2 ? 2 : 1 },
          768: { slidesPerView: this.columnsDesktop >= 2 ? 2 : this.columnsDesktop === 2 ? 2 : 1 },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      "trust-bar": {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: 1 },
          415: { slidesPerView: this.columnsMobile },
          768: { slidesPerView: Math.min(this.items.length, this.columnsDesktop) },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      "latest-blog-posts": {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: 1 },
          415: { slidesPerView: this.columnsMobile },
          576: { slidesPerView: 2 },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      videos: {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: 1 },
          415: { slidesPerView: 2 },
          768: { slidesPerView: 3 },
          992: { slidesPerView: this.columns },
        },
      },
      instagram: {
        slidesPerView: 2,
        breakpoints: {
          0: { slidesPerView: 2 },
          415: { slidesPerView: this.columnsMobile },
          768: { slidesPerView: 4 },
          992: { slidesPerView: 5 },
          1200: { slidesPerView: this.columnsDesktop },
        },
      },
      "product-gallery": {
        slidesPerView: 1,
        thumbs: {
          swiper: this.thumbnailsSlider,
        },
      },
      "product-gallery-thumbs": {
        slidesPerView: 3,
        loop: true,
        freeMode: false,
        breakpoints: {
          0: {
            direction: "horizontal",
            slidesPerView: 3,
          },
          576: {
            direction: "horizontal",
            slidesPerView: 4,
          },
          768: {
            direction: "horizontal",
            slidesPerView: 3,
          },
          992: {
            slidesPerView: 4,
            direction: this.thumbnailsDirection,
          },
        },
      },
      "bought-together": {
        slidesPerView: 1,
        breakpoints: {
          0: {
            slidesPerView: 1,
          },
          576: {
            slidesPerView: this.layoutType === "single" ? 1 : 2,
          },
          991: {
            slidesPerView: this.columnsDesktop,
          },
        },
      },
      categories: {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: this.columnsMobile },
          576: { slidesPerView: this.columnsDesktop >= 2 ? 2 : 1 },
          768: { slidesPerView: this.columnsDesktop >= 3 ? 3 : this.columnsDesktop === 2 ? 2 : 1 },
          992: { slidesPerView: this.columnsDesktop },
        },
      },
      "recently-viewed": {
        slidesPerView: 1,
        breakpoints: {
          0: { slidesPerView: this.columnsMobile },
          576: { slidesPerView: 2 },
          768: { slidesPerView: 3 },
          992: { slidesPerView: 4 },
          1200: { slidesPerView: this.columnsDesktop },
        },
      },
    };
    if (Object.prototype.hasOwnProperty.call(layouts, this.layout)) return layouts[this.layout];
    else throw new Error(`Missing or invalid sw-layout in swiper-slider: ${this.layout}`);
  }

  #swiperConfig() {
    return {
      spaceBetween: this.spaceBetween,
      direction: this.direction,
      rewind: this.rewind && !this.loop && this.items.length > 1,
      loop: this.loop && this.items.length > 1,
      freeMode: this.freeMode,
      effect: this.effect,
      observer: this.observer,
      observeParents: this.observer,
      autoHeight: this.autoHeight,
      grabCursor: this.grab,
      watchSlidesProgress: true,
      navigation: this.#navigation(),
      pagination: this.#pagination(),
      autoplay: this.#autoplay(),
      initialSlide: window[`swiperSlideIndex_${this.root.id}`] || 0,
      ...this.#layout(),
    };
  }

  #decideLoadingMethod(slide, slideIdx) {
    // if the slide is visible on the first non scrolled view set the loading to eager
    if (this.root.getBoundingClientRect().top <= window.innerHeight) {
      const visibleSlides = window.innerWidth < 768 ? this.columnsMobile : this.columnsDesktop;
      const img = slide.querySelector("img");
      if (img) img.setAttribute("loading", slideIdx < visibleSlides ? "eager" : "lazy");
    }
  }

  #initSwiper() {
    this.swiper = new Swiper(this, this.#swiperConfig());
    this.items.forEach((slide, slideIdx) => {
      slide.setAttribute("role", "region");
      this.#decideLoadingMethod(slide, slideIdx);
    });

    this.#updatePaginationType(); // Ensure the pagination type is set correctly after Swiper is initialized
  }
}
window.customElements.define("swiper-slider", SwiperSlider);

class RecentlyViewedProducts extends CustomHTMLElement {
  constructor() {
    super();
    this.container = this.querySelector(".product-blocks-wrapper");
  }

  initialize() {
    this.fetchViewedProducts();
  }

  async fetchViewedProducts() {
    let visitedProducts = localStorage.getItem("visitedProductIDs");
    visitedProducts = visitedProducts ? JSON.parse(visitedProducts) : [];

    if (visitedProducts.length === 0) {
      this.style.display = "none";
      return; // Exit early if there are no visited products
    }

    const dataLimit = +this.getAttribute("data-limit") || 10;
    const idsString = visitedProducts.slice(0, dataLimit).join(",");

    const res = await localizedFetch(`/search?sections=product-feed&omit_filters=true&only_products=${idsString}`);
    const feed = await res.text();
    const dom = new DOMParser().parseFromString(feed, "text/html");
    const pbs = dom.querySelectorAll(".product-block");
    const isCarousel = this.getAttribute("data-display") === "carousel";

    const nodepool = {};
    pbs.forEach((node) => (nodepool[node.dataset.productId] = node));

    if (isCarousel) pbs.forEach((node) => node.classList.add("swiper-slide"));
    const ids = visitedProducts.filter((id) => nodepool[id]);

    this.container.innerHTML = "";
    ids.forEach((id) => this.container.appendChild(nodepool[id]));
  }

  // This forces callers to be declared later => a product page using this
  // web component will not instantly reflect the product being visited
  static pushProduct(id) {
    id = +id;
    if (isNaN(id) || id <= 0) return;

    let visitedProducts = localStorage.getItem("visitedProductIDs");
    visitedProducts = visitedProducts ? JSON.parse(visitedProducts) : [];
    visitedProducts.unshift(id);
    visitedProducts = visitedProducts.filter((v, i) => visitedProducts.indexOf(v) === i).slice(0, 40);
    localStorage.setItem("visitedProductIDs", JSON.stringify(visitedProducts));
  }
}
window.customElements.define("recently-viewed", RecentlyViewedProducts);

class ProductReviews extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.product = +this.getAttribute("data-productid");
    this.limit = +this.getAttribute("data-limit") || 6;
    this.reviewsClass = this.getAttribute("data-reviews-class");
    this.reviewsStyle = this.getAttribute("data-reviews-style");
    this.reviewsStyleBundle = this.getAttribute("data-reviews-style-bundle");
    this.reviewsStyleBorder = this.getAttribute("data-reviews-style-border");
    this.nameFilter = this.getAttribute("data-name-filter");
    this.reviewsPage = 1;
    this.sort = "date_desc";
    this.currentSortText = $(".product-reviews__current-sort");
    this.loadingIcon = $(".product-reviews__loading");
    this.moreReviewsButton = $("#load-more-reviews");
    this.container = $(".product-reviews__wrapper");
    this.moreReviewsButton.on("click", () => this.insertReviews());
    this.registerSorters();
    this.resetReviews();
    this.insertReviews();
  }

  registerSorters() {
    const self = this;
    $("a[pr-sort]").each(function (_, element) {
      $(element).on("click", function () {
        $("a[pr-sort]").each((__, item) => $(item).removeClass("active").removeClass("theme-dropdown__link--active"));
        const link = $(element);
        link.addClass("active").addClass("theme-dropdown__link--active");
        self.sort = link.attr("pr-sort");
        self.currentSortText.text(link.text());
        self.resetReviews();
        self.insertReviews();
      });
    });
  }

  resetReviews() {
    this.container.empty();
    this.reviewsPage = 1;
  }

  async insertReviews() {
    this.moreReviewsButton.hide();
    this.loadingIcon.show();

    try {
      const data = await Jumpseller.fetchReviews(this.product, this.reviewsPage++, this.sort, this.limit);
      const { reviews, page_count } = data;

      reviews.forEach((review) => {
        this.container.append(this.buildReviewHtml(review.text, review.rating, review.customer, review.date));
      });

      this.updateExpandReviewTextButtonsVisibility();
      this.reviewsPage > page_count ? this.moreReviewsButton.hide() : this.moreReviewsButton.show();
    } catch (err) {
      this.moreReviewsButton.show();
      console.error(err);
    }

    this.loadingIcon.hide();
  }

  buildReviewHtml(text, rating, customer, date) {
    const emptyStar = `<span class="ph-fill ph-star product-ratings__star"></span>`;
    const filledStars = `<span class="ph-fill ph-star product-ratings__star product-ratings__star--filled"></span>`;
    const showMoreButton = $(
      `<button class="review-block__expand">${I18N.show_more} <i class="ph ph-caret-down"></i></button>`,
    );
    const showLessButton = $(
      `<button class="review-block__expand">${I18N.show_less} <i class="ph ph-caret-up"></i></button>`,
    );

    showMoreButton.on("click", function () {
      const reviewBlock = $(this).closest(".review-block");
      reviewBlock.find(".review-block__content").addClass("expanded");
      $(this).hide();
      reviewBlock.find(".review-block__expand:last").show();
    });

    showLessButton.on("click", function () {
      const reviewBlock = $(this).closest(".review-block");
      reviewBlock.find(".review-block__content").removeClass("expanded");
      $(this).hide();
      reviewBlock.find(".review-block__expand:first").show();
    });

    const review = $(`
      <div class="review-block ${this.reviewsClass}">
        <div class="review-block__wrapper">
          <div class="review-block__content check-empty">${text}</div>
          <div class="review-block__rating">
            <div class="product-ratings">
              <span class="product-ratings__score">${rating}</span>
              <span class="product-ratings__divider"></span>
              <div class="product-ratings__stars">
                ${filledStars.repeat(rating)}
                ${emptyStar.repeat(5 - rating)}
              </div>
            </div>
          </div>
          <div class="review-block__footer">
            <div class="review-block__customer${customer === null ? " hidden" : ""}">${this.nameFilter === "first_name" ? customer.split(" ")[0] : customer}</div>
            <div class="review-block__date${date === null ? " hidden" : ""}">${date}</div>
          </div>
        </div>
      </div>
    `);

    review.find(".review-block__content").after(showLessButton.hide()).after(showMoreButton);

    if (this.reviewsStyle === "true") {
      review.addClass("review-block--card");
      review.find(".review-block__wrapper").attr("data-bundle-color", this.reviewsStyleBundle);
      review.find(".review-block__wrapper").attr("data-border", this.reviewsStyleBorder);
    }

    return review;
  }

  updateExpandReviewTextButtonsVisibility() {
    $(".review-block").each(function () {
      const reviewBlock = $(this);
      const reviewText = reviewBlock.find(".review-block__content");
      const showMoreButton = reviewBlock.find(".review-block__expand").first();
      const showLessButton = reviewBlock.find(".review-block__expand").last();

      if (reviewText[0].scrollHeight > reviewText[0].clientHeight) {
        showMoreButton.show();
        showLessButton.hide();
      } else {
        showMoreButton.hide();
        showLessButton.hide();
      }
    });
  }
}
window.customElements.define("product-reviews", ProductReviews);

class ProductStockLocations extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    const firstRenderedProductId = +this.getAttribute("data-productid");
    this.stockLocationsData = JSON.parse(this.querySelector("script.product-stock-locations-json").textContent);
    this.buildStockLocations(firstRenderedProductId);
  }

  buildStockLocations(productId) {
    if (typeof this.stockLocationsData === "undefined") return;

    const product =
      this.stockLocationsData.info.variants.length === 0
        ? this.stockLocationsData.info.product
        : this.stockLocationsData.info.variants.find((x) => x.id === productId);

    if (product.status === "not-available" || this.stockLocationsData.info.stockOrigins.length <= 1) {
      $("product-stock-locations").addClass("hidden");
      return;
    }

    $(".product-stock-locations__content").html(
      this.stockLocationsData.info.stockOrigins
        .map((location) => this.#buildStockLocationEntry(product, location))
        .filter(Boolean)
        .join(""),
    );
  }

  #buildStockLocationEntry(product, location) {
    const stockLocation = product.stock_locations.find((item) => item.location_name === location.name);
    const stockValue = stockLocation ? stockLocation.stock : null;

    const stockLocationIcons = {
      available: `<i class="ph-fill ph-circle product-stock__icon product-stock__icon--available"></i>`,
      "low-stock": `<i class="ph-fill ph-circle product-stock__icon product-stock__icon--low-stock"></i>`,
      "out-of-stock": `<i class="ph-fill ph-circle product-stock__icon product-stock__icon--out-of-stock"></i>`,
    };

    let locationAvailabilityHtml = "";
    if (product.stock_unlimited) {
      locationAvailabilityHtml = `
        <div class="product-stock-locations__status" data-label="available">
          ${stockLocationIcons["available"]}
          <span>${I18N.available_in_stock}</span>
        </div>
      `;
    } else if (product.stock === 0 || stockValue === 0) {
      locationAvailabilityHtml = `
        <div class="product-stock-locations__status" data-label="out-of-stock">
          ${stockLocationIcons["out-of-stock"]}
          <span>${I18N.out_of_stock}</span>
        </div>
      `;
    } else if (product.stock_notification && stockValue > 0 && stockValue <= product.stock_threshold) {
      locationAvailabilityHtml = `
        <div class="product-stock-locations__status" data-label="lowstock">
          ${stockLocationIcons["low-stock"]}
          <span class="product-stock__text">${I18N.low_stock_basic}</span>
          <span class="product-stock__text-exact">${formatTranslation(I18N.low_stock_basic_exact, { qty: stockValue })}</span>
        </div>
      `;
    } else if (stockValue > 0) {
      locationAvailabilityHtml = `
        <div class="product-stock-locations__status" data-label="available">
          ${stockLocationIcons["available"]}
          <span class="product-stock__text">${I18N.available_in_stock}</span>
          <span class="product-stock__text-exact">${formatTranslation(I18N.x_units_in_stock, { qty: stockValue })}</span>
        </div>
      `;
    }

    const geoLocationText = [location.municipality, location.region, location.country].filter(Boolean).join(", ");
    const geoLocationMap =
      location.latitude && location.longitude
        ? `<a class="product-stock-locations__link" href="https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}" title="${I18N.product_stock_locations_link_text}" target="_blank"><i class="ph-fill ph-navigation-arrow"></i></a>`
        : "";

    return `
          <div class="product-stock-locations__entry">
            <div class="product-stock-locations__heading">
              <span class="product-stock-locations__name">${location.name}</span>
              ${geoLocationMap}
            </div>
            <span class="product-stock-locations__geolocation">${geoLocationText}</span>
            <span class="product-stock-locations__address">${location.address_with_street_number}</span>
            ${locationAvailabilityHtml}
          </div>
        `;
  }
}
window.customElements.define("product-stock-locations", ProductStockLocations);

class ProductStock extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.stockLocationIcons = {
      available: `<i class="ph-fill ph-circle product-stock__icon product-stock__icon--available"></i>`,
      "low-stock": `<i class="ph-fill ph-circle product-stock__icon product-stock__icon--low-stock"></i>`,
      "out-of-stock": `<i class="ph-fill ph-circle product-stock__icon product-stock__icon--out-of-stock"></i>`,
    };

    this.script = this.querySelector(`script.product-stock-json`);
    this.data = JSON.parse(this.script.textContent);
    this.options = this.data.options;
    this.buildStock(this.data.info.product);
  }

  hide() {
    this.classList.add("hidden");
  }

  show() {
    this.classList.remove("hidden");
  }

  buildLowStockBadge(stock) {
    this.classList.add(`product-stock--${this.options.low_stock_version}`);
    switch (this.options.low_stock_version) {
      case "basic":
        return `
          ${this.stockLocationIcons["low-stock"]}
          <span class="product-stock__text">${I18N.low_stock_basic}</span>
          <span class="product-stock__text-exact">${formatTranslation(I18N.low_stock_basic_exact, { qty: stock })}</span>
        `;
      case "limited":
        return `
          ${this.stockLocationIcons["low-stock"]}
          <span class="product-stock__text">${I18N.low_stock_limited}</span>
          <span class="product-stock__text-exact">${formatTranslation(I18N.low_stock_limited_exact, { qty: stock })}</span>
        `;
      case "alert":
        return `
          <i class="ph ph-fill ph-hourglass-low"></i>
          <span class="product-stock__text">${I18N.low_stock_alert}</span>
          <span class="product-stock__text-exact">${formatTranslation(I18N.low_stock_alert_exact, { qty: stock })}</span>
        `;
      default:
        return "";
    }
  }

  buildStock(product) {
    this.show();
    if (product.status === "not-available") {
      this.hide();
      this.setAttribute("data-label", "out-of-stock");
      return;
    }

    let productStockHtml = "";
    this.classList.remove(`product-stock--${this.options.low_stock_version}`);
    if (product.stock_unlimited) {
      this.setAttribute("data-label", "available");
      productStockHtml = `
        ${this.stockLocationIcons["available"]}
        <span>${I18N.available_in_stock}</span>
      `;
    } else if (product.stock === 0) {
      this.setAttribute("data-label", "out-of-stock");
      productStockHtml = `
        ${this.stockLocationIcons["out-of-stock"]}
        <span>${I18N.out_of_stock}</span>
      `;
    } else if (product.stock_notification && product.stock > 0 && product.stock <= product.stock_threshold) {
      this.setAttribute("data-label", "lowstock");
      productStockHtml = this.buildLowStockBadge(product.stock);
    } else if (product.stock > 0) {
      this.setAttribute("data-label", "available");
      productStockHtml = `
        ${this.stockLocationIcons["available"]}
        <span class="product-stock__text">${I18N.available_in_stock}</span>
        <span class="product-stock__text-exact">${formatTranslation(I18N.x_units_in_stock, { qty: product.stock })}</span>
      `;
    }

    this.innerHTML = this.script.outerHTML + productStockHtml;
  }
}
window.customElements.define("product-stock", ProductStock);

class ProductForm extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.buildProductForm();
  }

  getIsOutOfStock() {
    return this.isOutOfStock;
  }

  replaceHtml(html) {
    this.innerHTML = this.script.outerHTML + html;
  }

  buildProductForm(variant) {
    this.script = this.querySelector(`script.product-form-json`);
    this.data = JSON.parse(this.script.textContent);
    this.options = this.data.options;
    this.status = this.data.info.status;
    this.product = this.data.info.product;
    this.isOutOfStock = false;
    this.variant = typeof variant === "undefined" || variant === null ? this.data.info.variant : variant;
    this.variant.price_with_discount = this.variant.discount
      ? this.variant.price - this.variant.discount
      : this.variant.price;

    if (this.querySelector("#product-status-out-of-stock")) this.appendChild(this.#getOutOfStockSection());

    const productFormInput = this.querySelector(".product-form__input");
    const productFormButton = this.querySelector("button#add-to-cart");
    const productFormHandler = this.querySelector(".product-form__handler");
    const productFormOptions = this.querySelector(".product-options");
    const productFormActions = this.querySelector(".product-form__actions");
    const productOutOfStockSection = this.querySelector("#product-status-out-of-stock");
    const quantity = +productFormInput.value;

    if (!productFormInput || !productFormButton || !productFormHandler || !productFormActions) {
      console.error("Some components are missing in product-form");
      return;
    }

    if (this.options.disableShoppingCart) {
      this.isOutOfStock = false;
      if (productFormOptions) productFormOptions.classList.remove("hidden");
      productFormActions.classList.add("hidden");
      this.replaceHtml(this.#getDisableShoppingFeaturesSection());
    } else if (this.product.status === "not-available") {
      this.isOutOfStock = false;
      if (productFormOptions) productFormOptions.classList.add("hidden");
      productFormActions.classList.add("hidden");
      this.replaceHtml(this.#getNotAvailableSection());
    }
    // out of stock for all variants (or just product)
    else if (this.data.info.product.stock === 0 && this.data.info.product.stock_unlimited === false) {
      this.isOutOfStock = true;
      if (productFormOptions) productFormOptions.classList.remove("hidden");
      if (productOutOfStockSection) productOutOfStockSection.classList.remove("hidden");
      productFormActions.classList.add("hidden");
      if (this.variant) this.#changeBackInStockUrl(this.variant.id);
    }
    // out of stock for selected variant
    else if (this.variant.stock === 0 && this.variant.stock_unlimited === false) {
      this.isOutOfStock = true;
      this.#changeBackInStockUrl(this.variant.id);
      if (productOutOfStockSection) productOutOfStockSection.classList.remove("hidden");
      if (productFormOptions) productFormOptions.classList.remove("hidden");
      productFormActions.classList.remove("hidden");
      productFormButton.disabled = true;
      productFormHandler.disabled = true;
      productFormButton.querySelector("span").textContent = I18N.out_of_stock;
      productFormInput.disabled = true;
      productFormInput.value = 1;
      productFormInput.setAttribute("max", 1);
    }
    // available with stock
    else {
      this.isOutOfStock = false;
      if (productFormOptions) productFormOptions.classList.remove("hidden");
      productFormActions.classList.remove("hidden");
      productFormButton.disabled = false;
      productFormHandler.disabled = false;
      productFormButton.querySelector("span").textContent = I18N.add_to_cart;
      if (productOutOfStockSection) productOutOfStockSection.classList.add("hidden");
      productFormInput.disabled = false;
      const newValue = this.variant.stock_unlimited ? quantity : Math.min(this.variant.stock, quantity);
      productFormInput.value = newValue;

      if (this.variant.maximum_quantity) productFormInput.setAttribute("max", this.variant.maximum_quantity);
      else if (!this.variant.stock_unlimited) productFormInput.setAttribute("max", this.variant.stock);

      const maximumToBuy = parseFloat(productFormInput.getAttribute("data-max")) || Infinity;
      this.querySelector(".quantity-down").disabled = quantity <= 1;
      this.querySelector(".quantity-up").disabled = newValue >= maximumToBuy;

      const buyNowButton = this.querySelector("#buy-now-button");
      if (buyNowButton) {
        const canBuy = canBuyNow({
          quantity: newValue,
          minQuantity: this.product.minimum_quantity,
          price: this.variant.price_with_discount,
        });
        buyNowButton.disabled = !canBuy;
        buyNowButton.textContent = canBuy ? I18N.buy_now : I18N.buy_now_not_allowed;
      }
    }

    $('.variants input[type="radio"].disabled').parent().addClass("should-hide");

    const data = JSON.parse(this.querySelector(`script.product-form-json`).textContent);
    RecentlyViewedProducts.pushProduct(data.info.product.id);
  }

  #changeBackInStockUrl(variantId = null) {
    const backInStockUrl = this.product.back_in_stock_url + (variantId === null ? "" : `?variant_id=${variantId}`);
    const backInStockLink = this.querySelector("#product-status-back-in-stock");
    if (backInStockLink) backInStockLink.setAttribute("href", backInStockUrl);
  }

  #getStatusBackInStock() {
    const text = I18N.notify_me_when_available;
    const href = this.product.back_in_stock_url;
    return `<a
        id="product-status-back-in-stock"
        href="${href}"
        class="button button--style button--secondary product-message__button"
        title="${text}"
        target="_blank"
      >
        <i class="theme-icon ph ph-warning-circle"></i>
        ${text}
      </a>`;
  }

  #getStatusContact() {
    const text = I18N.contact_us;
    return `<a
        id="product-status-contact"
        href="${this.data.info.contact.url}"
        class="button button--style button--secondary product-message__button"
        title="${text}"
        target="_blank"
      >
        <i class="theme-icon ph ph-envelope-simple"></i>
        ${text}
      </a>`;
  }

  #getStatusWhatsapp() {
    if (this.data.info.social.whatsapp.url === "") return;

    const text = I18N.send_us_a_message;
    const text_info = I18N.more_info;
    const share_url = this.product.share_url;

    return `<a
        id="product-status-whatsapp"
        href="${this.data.info.social.whatsapp.url}&text=${text_info}%20${share_url}"
        class="button button--style button--whatsapp product-message__button"
        title="${text}"
        target="_blank"
      >
        <i class="theme-icon ph ph-whatsapp-logo"></i>
        ${text}
      </a>`;
  }

  #getStatusContinue() {
    const text = I18N.continue_shopping;
    return `<a
        id="product-status-continue"
        href="javascript:history.back()"
        class="product-message__link"
        title="${text}"
      >
        ${text}
      </a>`;
  }

  #getDisableShoppingFeaturesSection() {
    return `<div class="product-message" id="product-status-shopping-disabled">
        <div class="product-message__title check-empty">${this.options.disableShoppingCartTitle}</div>
        <div class="product-message__text check-empty">${this.options.disableShoppingCartText}</div>
        ${this.options.disableShoppingCartContact === true ? this.#getStatusContact() : ""}
        ${this.options.disableShoppingCartWhatsapp === true ? this.#getStatusWhatsapp() : ""}
        ${this.#getStatusContinue()}
      </div>`;
  }

  #getOutOfStockSection() {
    let backInStockPart = "";
    if (this.product.back_in_stock_enabled && this.product.back_in_stock_url !== "")
      backInStockPart = this.#getStatusBackInStock();
    else if (this.status.buttonContact) backInStockPart = this.#getStatusContact();

    return `<div class="product-message" id="product-status-out-of-stock">
        <div class="product-message__title check-empty">${this.status.outOfStockTitle}</div>
        <div class="product-message__text check-empty">${this.status.outOfStockText}</div>
        ${backInStockPart}
        ${this.status.buttonWhatsapp ? this.#getStatusWhatsapp() : ""}
        ${this.#getStatusContinue()}
      </div>`;
  }

  #getNotAvailableSection() {
    return `<div class="product-message" id="product-status-not-available">
        <div class="product-message__title check-empty">${this.status.notAvailableTitle}</div>
        <div class="product-message__text check-empty">${this.status.notAvailableText}</div>
        ${this.status.buttonContact ? this.#getStatusContact() : ""}
        ${this.status.buttonWhatsapp ? this.#getStatusWhatsapp() : ""}
        ${this.#getStatusContinue()}
      </div>`;
  }
}
window.customElements.define("product-form", ProductForm);

class ProductPrice extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.buildProductPrice();
  }

  buildProductPrice(variantId) {
    this.script = this.querySelector(`script.product-price-json`);
    this.data = JSON.parse(this.script.textContent);
    this.options = this.data.options;
    this.variantId = variantId ? +variantId : +this.getAttribute("data-productid");
    this.product =
      this.data.info.variants.length === 0
        ? this.data.info.product
        : this.data.info.variants.find((x) => x.id === this.variantId);

    Array.from(this.children).forEach((child) => {
      if (child.tagName.toLowerCase() !== "script") child.remove(); // remove all previous children
    });

    if (this.options.disablePrices) return;

    const elements = [
      { tag: "span", className: "product-page__price" },
      { tag: "span", className: "product-page__price product-page__price--new" },
      { tag: "span", className: "product-page__price product-page__price--old" },
      { tag: "span", className: "product-page__discount-label" },
      { tag: "div", className: "product-page__discount-message" },
    ];

    const [productNormalPrice, productNewPrice, productOldPrice, productDiscountBadge, productDiscountMessage] =
      elements.map(({ tag, className }) => {
        const element = document.createElement(tag);
        element.className = className;
        this.appendChild(element);
        return element;
      });

        const addIvaText = (priceElement) => {
     if (this.getAttribute("data-show-iva") === "true") {
       const ivaText = document.createElement("span");
       ivaText.className = "product-page__iva-text";
       ivaText.textContent = " +IVA";
       priceElement.appendChild(ivaText);
     }
   };

    if (this.product.discount > 0) {
      this.price = this.product.price - this.product.discount;
      productNormalPrice.classList.add("hidden");
      productNewPrice.classList.remove("hidden");
      productOldPrice.classList.remove("hidden");
      productNewPrice.textContent = this.product.price_with_discount_formatted;
      productOldPrice.textContent = this.product.price_formatted;

       addIvaText(productNewPrice);

      if (this.options.showDiscountBadge) {
        productDiscountBadge.classList.remove("hidden");
        productDiscountBadge.textContent = `-${this.product.percentage_off}% ${this.options.showDiscountBadgeText}`;
      } else productDiscountBadge.classList.add("hidden");

      if (this.options.showDiscountMessage && this.product.discount_begins && this.product.discount_expires) {
        productDiscountMessage.classList.remove("hidden");
        productDiscountMessage.textContent = formatTranslation(I18N.discount_message, {
          date_begins: this.product.date_begins,
          date_expires: this.product.date_expires,
        });
      } else productDiscountMessage.classList.add("hidden");
    } else {
      productNormalPrice.classList.remove("hidden");
      productNewPrice.classList.add("hidden");
      productOldPrice.classList.add("hidden");
      productDiscountBadge.classList.add("hidden");
      productDiscountMessage.classList.add("hidden");
      productNormalPrice.textContent = this.product.price_formatted;
      this.price = this.product.price;
    }

    (window.storeInfo ||= {}).product = {
      ...this.product,
      price_with_discount: this.price,
    };
    addIvaText(productNormalPrice);
  }
}
window.customElements.define("product-price", ProductPrice);

class ProductAttributes extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.buildProductAttributes();
  }

  hide() {
    this.classList.add("hidden");
  }

  show() {
    this.classList.remove("hidden");
  }

  buildProductAttributes(variant) {
    this.script = this.querySelector(`script.product-attributes-json`);
    this.data = JSON.parse(this.script.textContent);
    this.options = this.data.options;
    this.sku = typeof variant === "undefined" || variant === null ? this.data.info.variant.sku : variant.sku;
    this.brand = this.data.info.variant.brand;

    const sku = this.querySelector(".product-page__sku");
    const brand = this.querySelector(".product-page__brand");
    const divider = this.querySelector(".product-page__attributes--divider");

    if ((!this.brand && !this.sku) || (!this.options.showBrand && !this.options.showSku)) {
      this.hide();
      return;
    } else this.show();

    if (this.options.showBrand && this.brand && this.options.showSku && this.sku) divider.classList.remove("hidden");
    else divider.classList.add("hidden");

    if (this.options.showSku) {
      if (!this.sku) sku.classList.add("hidden");
      else {
        sku.classList.remove("hidden");
        sku.textContent = `${this.options.showSkuText ? `${I18N.SKU}: ` : ""}${this.sku}`;
      }
    } else sku.classList.add("hidden");

    if (this.options.showBrand) {
      if (!this.brand) brand.classList.add("hidden");
      else {
        brand.classList.remove("hidden");
        brand.textContent = this.brand;
      }
    } else brand.classList.add("hidden");
  }
}
window.customElements.define("product-attributes", ProductAttributes);

class CartArea extends CustomHTMLElement {
  constructor() {
    super();
    this.isLoading = false;
    this.placeholderImg = `//assets.jumpseller.com/public/placeholder/themes/base/placeholder-image-product-thumb.jpg`;
  }

  async initialize() {
    this.setupEventHandlers();
  }

  setIsLoading(value) {
    if (this.isLoading === value) return;
    this.isLoading = value;
    this.classList.toggle("disabled", value);
    document.querySelector(".store-totals").classList.toggle("disabled", value);
  }

  setupEventHandlers() {
    const cartItems = this.querySelectorAll(".store-product");
    cartItems.forEach((cartItem) => {
      const cartItemId = cartItem.getAttribute("data-id");
      const $item = $(cartItem);
      const $deleteButton = $item.find(".store-product__delete");
      const $minusButton = $item.find(".store-product__handler--minus");
      const $plusButton = $item.find(".store-product__handler--plus");
      const $qtyInput = $item.find(".store-product__input");

      $deleteButton.off("click").on("click", () => {
        this.updateCartData(cartItemId, 0, null);
      });

      $minusButton.off("click").on("click", () => {
        if (this.isLoading) return;
        const currentQty = parseInt($qtyInput.val(), 10);
        if (currentQty <= 1) return;
        const newQty = currentQty - 1;
        this.updateCartData(cartItemId, newQty, currentQty, null, (oldQty) => {
          $qtyInput.val(oldQty);
        });
      });

      $plusButton.off("click").on("click", () => {
        if (this.isLoading) return;
        const currentQty = parseInt($qtyInput.val(), 10);
        const newQty = currentQty + 1;
        this.updateCartData(cartItemId, newQty, currentQty, null, (oldQty) => {
          $qtyInput.val(oldQty);
        });
      });
    });

    $(".store-totals__column[data-name='coupons'] .store-totals__code").each(function () {
      $(this)
        .find(".store-totals__remove")
        .on("click", async () => {
          Jumpseller.removeCouponFromCart($(this).data("value"), 0);
          await refreshCartDisplay();
        });
    });
  }

  updateCartData(cartItemId, newQty, prevQty, onSuccess, onError) {
    if (this.isLoading) return;

    const debounceKey = +cartItemId;
    const handles = (window.cartDebounceHandles = window.cartDebounceHandles || {});
    const handle = (handles[debounceKey] = handles[debounceKey] || { qty: prevQty });

    clearTimeout(handle.handle);
    handle.handle = setTimeout(() => {
      const oldQty = handle.qty;
      delete handles[debounceKey];

      this.setIsLoading(true);
      Jumpseller.updateCart(cartItemId, newQty, {
        callback: async (data) => {
          this.setIsLoading(false);
          if (data.status && data.status !== 200) {
            if (onError) onError(oldQty);
            new ToastNotification({
              type: "error",
              title: I18N.error_updating_to_cart,
              message: data.responseJSON.message,
            });
            return;
          }
          if (onSuccess) onSuccess();
          await refreshCartDisplay();
        },
      });
    }, window.theme.cart.debounce);
  }
}
window.customElements.define("cart-area", CartArea);

class ProductBlockSwatch extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    const self = this;
    this.querySelectorAll("button.product-block__color").forEach(function (element) {
      element.addEventListener("click", function () {
        self.#changeImageOnColorChange(element);
      });
    });
  }

  #changeImageOnColorChange(element) {
    const productBlock = element.closest(".product-block");
    productBlock
      .querySelectorAll(".product-block__color")
      .forEach((item) => item.classList.remove("product-block__color--active"));
    element.classList.add("product-block__color--active");

    const imageOption = element.getAttribute("data-image");
    if (!imageOption) return;

    const productBlockImage = productBlock.querySelector(".product-block__image");
    const productBlockImageSources = productBlock.querySelectorAll(".product-block__picture source");

    productBlockImage.src = imageOption;
    productBlockImageSources.forEach((source) => (source.srcset = imageOption));
  }
}
window.customElements.define("product-block-swatch", ProductBlockSwatch);

class ProductWishlist extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.buildWishlist();
  }

  buildWishlist(variantId) {
    this.data = JSON.parse(this.querySelector(`script.product-wishlist-json`).textContent).info;

    this.product = this.data.product;
    this.variants = this.variants ? this.variants : this.product.variants;
    this.customer = this.data.customer;
    this.productId = this.product.id;
    this.variantId =
      typeof variantId === "undefined" || variantId === null ? this.data.product.first_variant_id : variantId;

    const wishlisted = this.variants
      ? this.variants.find((variant) => variant.variant_id === this.variantId).wishlisted
      : this.product.wishlisted_product;

    this.updateIcon(wishlisted);
    this.#changeWishlistURL(this.product, this.variantId);
  }

  updateIcon(wishlisted) {
    if (!wishlisted) {
      $(`.add-to-wishlist${this.productId}`).removeClass("hidden");
      $(`.remove-from-wishlist${this.productId}`).addClass("hidden");
    } else {
      $(`.add-to-wishlist${this.productId}`).addClass("hidden");
      $(`.remove-from-wishlist${this.productId}`).removeClass("hidden");
    }
  }

  #changeWishlistURL(product, variantId) {
    const addWishlistUrl = product.wishlist_add_url + (variantId === null ? "" : `?variant_id=${variantId}`);
    $(`.add-to-wishlist${this.productId}`, this).attr("onclick", `addToWishlist(this,"${addWishlistUrl}")`);
    const removeWishlistUrl = product.wishlist_remove_url + (variantId === null ? "" : `?variant_id=${variantId}`);
    $(`.remove-from-wishlist${this.productId}`, this).attr(
      "onclick",
      `removeFromWishlist(this,"${removeWishlistUrl}")`,
    );
  }
}
window.customElements.define("product-wishlist", ProductWishlist);

class ProductDownload extends CustomHTMLElement {
  constructor() {
    super();
  }

  initialize() {
    this.buildProductDownload();
  }

  buildProductDownload() {
    this.data = JSON.parse(this.querySelector(`script.product-download-json`).textContent);
    this.files = this.data.files;
    this.button = this.querySelector("#download-zip");
    this.button.addEventListener("click", async () => {
      await this.downloadZip();
    });
  }

  async downloadZip() {
    this.button.disabled = true;

    const icon = this.button.querySelector("#download-icon");
    icon.classList.remove("ph-download-simple");
    icon.classList.add("ph-spinner-gap", "fa-spin");

    const zip = new JSZip();
    const files = this.files;

    async function addFileToZip(file) {
      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`${I18N.error_downloading}: ${file.url}`);
        const blob = await response.blob();
        zip.file(file.name, blob);
      } catch (error) {
        console.error(error);
      }
    }

    await Promise.all(files.map(addFileToZip));

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${this.data.name}.zip`;
    link.click();

    icon.classList.remove("ph-spinner-gap", "fa-spin");
    icon.classList.add("ph-download-simple");
    this.button.disabled = false;
  }
}
window.customElements.define("product-download", ProductDownload);

class ToastNotification {
  constructor(options = {}) {
    this.message = options.message || "No notification message provided";
    this.type = options.type || "default";
    this.title = options.title || "";
    this.duration = options.duration || 4000;
    this.overtime = options.overtime || 1500;
    this.onclick = options.onclick || null;
    this.closeButton = options.closeButton ?? true;
    this.progressBar = options.progressBar ?? true;

    this.element = null;
    this.timeoutId = null;
    this.wrapper = document.querySelector(".toast-notification__wrapper");
    this.create();
  }

  create() {
    this.element = document.createElement("div");
    this.element.className = `toast-notification toast-notification--${this.type}`;
    this.element.innerHTML = `
      <div class="toast-notification__content">
        ${this.title ? `<div class="toast-notification__title">${this.title}</div>` : ""}
        <div class="toast-notification__message">${this.message}</div>
      </div>
      ${this.closeButton ? `<button class="toast-notification__close"><i class="ph ph-x"></i></button>` : ""}
      ${this.progressBar ? `<div class="toast-notification__progress"></div>` : ""}
    `;

    this.wrapper.appendChild(this.element);

    if (this.closeButton) {
      this.element.querySelector(".toast-notification__close").addEventListener("click", (event) => {
        event.stopPropagation();
        this.close();
      });
    }

    if (this.onclick) {
      this.element.classList.add("toast-notification--clickable");
      this.element.addEventListener("click", this.onclick);
    }

    this.element.addEventListener("mouseenter", () => this.pauseAutoClose());
    this.element.addEventListener("mouseleave", () => this.resumeAutoClose());

    requestAnimationFrame(() => {
      this.element.classList.add("toast-notification--enter");
      if (this.progressBar) this.startProgressBar();
    });

    this.autoClose();
  }

  startProgressBar() {
    const progressBar = this.element.querySelector(".toast-notification__progress");
    progressBar.style.transition = "none";
    progressBar.style.width = "100%";

    requestAnimationFrame(() => {
      progressBar.style.transition = `width ${this.duration}ms linear`;
      progressBar.style.width = "0%";
    });
  }

  resetProgressBar() {
    const progressBar = this.element.querySelector(".toast-notification__progress");
    progressBar.style.transition = "none";
    progressBar.style.width = "100%";

    requestAnimationFrame(() => {
      progressBar.style.transition = `width ${this.overtime}ms linear`;
      progressBar.style.width = "0%";
    });
  }

  autoClose() {
    this.timeoutId = setTimeout(() => this.close(), this.duration);
  }

  pauseAutoClose() {
    clearTimeout(this.timeoutId);
    const progressBar = this.element.querySelector(".toast-notification__progress");
    if (progressBar) {
      progressBar.style.transition = "none";
    }
  }

  resumeAutoClose() {
    if (this.progressBar) this.resetProgressBar();
    this.timeoutId = setTimeout(() => this.close(), this.overtime);
  }

  close() {
    clearTimeout(this.timeoutId);
    this.element.classList.remove("toast-notification--enter");
    this.element.classList.add("toast-notification--exit");
    this.element.addEventListener("animationend", () => this.element.remove(), { once: true });
  }
}

class StoreCounter extends CustomHTMLElement {
  constructor() {
    super();
    this.intervalId = null;
  }

  initialize() {
    this.countDownDate = new Date(this.getAttribute("counter")).getTime();
    this.timeZone = this.getAttribute("timezone") || "UTC";
    this.counterList = this.querySelector(".theme-counter__list") || this.createCounterList();
    this.startCounter();
  }

  show() {
    this.counterList.classList.remove("hidden");
  }

  hide() {
    this.counterList.classList.add("hidden");
  }

  createCounterList() {
    const counterList = document.createElement("div");
    counterList.classList.add("theme-counter__list");
    this.appendChild(counterList);
    return counterList;
  }

  startCounter() {
    this.updateCounter();
    this.intervalId = setInterval(() => this.updateCounter(), 1000);
  }

  updateCounter() {
    const now = new Date().toLocaleString("en-US", { timeZone: this.timeZone });
    const diff = this.countDownDate - new Date(now).getTime();

    this.show();
    if (diff <= 0) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.hide();
      return;
    }

    const timeUnits = [
      { label: "weeks", value: Math.floor(diff / (1000 * 60 * 60 * 24 * 7)) },
      { label: "days", value: Math.floor((diff / (1000 * 60 * 60 * 24)) % 7) },
      { label: "hours", value: Math.floor((diff / (1000 * 60 * 60)) % 24) },
      { label: "minutes", value: Math.floor((diff / (1000 * 60)) % 60) },
      { label: "seconds", value: Math.floor((diff / 1000) % 60) },
    ];

    const nonZeroUnits = timeUnits.filter((unit) => unit.value > 0 || unit.label === "seconds");
    const format = nonZeroUnits
      .map(
        (unit) =>
          `<div class="col-auto theme-counter__item">${unit.value.toString().padStart(2, "0")}
            <small>${unit.label}</small>
          </div>`,
      )
      .join("");

    this.counterList.innerHTML = format;
    this.counterList.setAttribute("data-counter-size", nonZeroUnits.length);
  }
}
window.customElements.define("store-counter", StoreCounter);

jQuery(() => {
  console.info(`[${new Date(Date.now()).toLocaleTimeString("en-GB", { hour12: false })}] Loaded theme.js`);
});
