/* ==========================================================================
   Centralized Checkout Pricing Service (PRD v1.2 Section III & VIII)
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  function isItemEligibleForCoupon(listing, coupon) {
    if (!coupon) return false;
    if (coupon.scope === "all") return true;
    if (coupon.scope === "category" && Array.isArray(coupon.allowedCategories)) {
      return coupon.allowedCategories.includes(listing.category);
    }
    if (coupon.scope === "seller" && Array.isArray(coupon.allowedSellers)) {
      return coupon.allowedSellers.includes(listing.sellerId);
    }
    return false;
  }

  /**
   * Computes deterministic proportional discount allocation with floor rounding
   * and remainder placed into the last eligible order in fixed sequence.
   */
  function allocateDiscountProportionally(orderGroups, coupon) {
    const allocations = new Map();
    orderGroups.forEach((g) => allocations.set(g.sellerId, 0));

    if (!coupon || orderGroups.length === 0) {
      return {
        appliedCoupon: null,
        effectiveDiscount: 0,
        totalEligibleSubtotal: 0,
        reason: coupon ? "Không có sản phẩm trong giỏ." : "Chưa áp dụng mã giảm giá.",
        allocations,
      };
    }

    const eligibleGroups = orderGroups.filter((g) => g.eligibleSubtotal > 0);
    const totalEligibleSubtotal = eligibleGroups.reduce((sum, g) => sum + g.eligibleSubtotal, 0);

    if (totalEligibleSubtotal <= 0 || eligibleGroups.length === 0) {
      return {
        appliedCoupon: coupon,
        effectiveDiscount: 0,
        totalEligibleSubtotal: 0,
        reason: `Không có sản phẩm đủ điều kiện cho mã ${coupon.code} → Không phân bổ giảm giá (0đ).`,
        allocations,
      };
    }

    if (coupon.minEligibleSubtotal && totalEligibleSubtotal < coupon.minEligibleSubtotal) {
      return {
        appliedCoupon: coupon,
        effectiveDiscount: 0,
        totalEligibleSubtotal,
        reason: `Giá trị hàng đủ điều kiện (${App.Utils.formatVnd(totalEligibleSubtotal)}) chưa đạt mức tối thiểu ${App.Utils.formatVnd(coupon.minEligibleSubtotal)}.`,
        allocations,
      };
    }

    const effectiveDiscount = Math.min(coupon.discountAmount, totalEligibleSubtotal);
    let allocatedSoFar = 0;

    for (let i = 0; i < eligibleGroups.length; i++) {
      const grp = eligibleGroups[i];
      if (i < eligibleGroups.length - 1) {
        const raw = effectiveDiscount * (grp.eligibleSubtotal / totalEligibleSubtotal);
        const floored = Math.min(grp.eligibleSubtotal, Math.floor(raw));
        allocations.set(grp.sellerId, floored);
        allocatedSoFar += floored;
      } else {
        const remainder = effectiveDiscount - allocatedSoFar;
        if (remainder <= grp.eligibleSubtotal) {
          allocations.set(grp.sellerId, remainder);
        } else {
          // Guard: never exceed an order's eligible subtotal; redistribute overflow to earlier orders with headroom
          allocations.set(grp.sellerId, grp.eligibleSubtotal);
          let overflow = remainder - grp.eligibleSubtotal;
          for (let j = 0; j < eligibleGroups.length - 1 && overflow > 0; j++) {
            const prev = eligibleGroups[j];
            const prevAlloc = allocations.get(prev.sellerId);
            const headroom = prev.eligibleSubtotal - prevAlloc;
            if (headroom > 0) {
              const add = Math.min(headroom, overflow);
              allocations.set(prev.sellerId, prevAlloc + add);
              overflow -= add;
            }
          }
        }
      }
    }

    return {
      appliedCoupon: coupon,
      effectiveDiscount,
      totalEligibleSubtotal,
      reason: `Đã phân bổ ${App.Utils.formatVnd(effectiveDiscount)} theo tỷ trọng trên ${App.Utils.formatVnd(totalEligibleSubtotal)} giá trị đủ điều kiện.`,
      allocations,
    };
  }

  /**
   * Validates cart & builds complete Checkout Pricing Preview (All-or-Nothing).
   */
  function calculateCheckoutPreview(state) {
    const blockingErrors = [];
    const priceChangedAlerts = [];
    const validLines = [];

    if (!state.cart || state.cart.length === 0) {
      return {
        isValid: false,
        hasPriceChanges: false,
        blockingErrors: ["Giỏ hàng đang trống."],
        priceChangedAlerts: [],
        orderGroups: [],
        couponInfo: {
          appliedCoupon: null,
          effectiveDiscount: 0,
          totalEligibleSubtotal: 0,
          reason: "Chưa có sản phẩm để tính giảm giá.",
        },
        totals: {
          subtotal: 0,
          shippingTotal: 0,
          vasTotal: 0,
          discountTotal: 0,
          grandTotal: 0,
        },
      };
    }

    const coupon = state.checkoutDraft && state.checkoutDraft.couponCode
      ? state.coupons.find((c) => c.code === state.checkoutDraft.couponCode) || null
      : null;

    state.cart.forEach((cartItem) => {
      const listing = state.listings.find((l) => l.id === cartItem.listingId);
      if (!listing) {
        blockingErrors.push(`Sản phẩm (${cartItem.listingId}) không còn tồn tại trong hệ thống.`);
        return;
      }
      if (listing.status !== "active") {
        blockingErrors.push(`"${listing.title}" hiện đang ở trạng thái "${listing.status}", không khả dụng để mua.`);
        return;
      }
      if (listing.stock <= 0 || cartItem.quantity > listing.stock) {
        blockingErrors.push(
          `"${listing.title}" không đủ tồn kho (yêu cầu ${cartItem.quantity}, còn ${listing.stock}). Toàn bộ Checkout bị chặn theo nguyên tắc All-or-Nothing.`
        );
        return;
      }
      if (cartItem.seenUnitPrice !== listing.price) {
        priceChangedAlerts.push({
          listingId: listing.id,
          title: listing.title,
          oldPrice: cartItem.seenUnitPrice,
          newPrice: listing.price,
        });
      }

      const seller = state.sellers.find((s) => s.id === listing.sellerId);
      if (!seller) {
        blockingErrors.push(`Không tìm thấy thông tin Seller (${listing.sellerId}) cho "${listing.title}".`);
        return;
      }

      const lineSubtotal = listing.price * cartItem.quantity;
      const eligible = isItemEligibleForCoupon(listing, coupon);

      validLines.push({
        cartItem,
        listing,
        seller,
        quantity: cartItem.quantity,
        snapshotUnitPrice: listing.price,
        lineSubtotal,
        eligibleForCoupon: eligible,
      });
    });

    // Group lines by Seller in fixed deterministic order (by sellerId)
    const groupsMap = new Map();
    validLines.forEach((line) => {
      if (!groupsMap.has(line.seller.id)) {
        const selectedVasId =
          (state.checkoutDraft && state.checkoutDraft.vasBySeller && state.checkoutDraft.vasBySeller[line.seller.id]) ||
          "vas-none";
        const vasObj = state.vasOptions.find((v) => v.id === selectedVasId) || state.vasOptions[0];

        groupsMap.set(line.seller.id, {
          sellerId: line.seller.id,
          seller: line.seller,
          lines: [],
          subtotal: 0,
          eligibleSubtotal: 0,
          shippingFee: line.seller.shippingFee, // CONF-02: Per-Order shipping
          vasOption: vasObj,
          vasFee: vasObj ? vasObj.fee : 0,
          discount: 0,
          total: 0,
        });
      }
      const grp = groupsMap.get(line.seller.id);
      grp.lines.push(line);
      grp.subtotal += line.lineSubtotal;
      if (line.eligibleForCoupon) {
        grp.eligibleSubtotal += line.lineSubtotal;
      }
    });

    const orderGroups = Array.from(groupsMap.values()).sort((a, b) =>
      a.sellerId.localeCompare(b.sellerId)
    );

    const discountResult = allocateDiscountProportionally(orderGroups, coupon);

    let subtotal = 0;
    let shippingTotal = 0;
    let vasTotal = 0;
    let discountTotal = 0;
    let grandTotal = 0;

    orderGroups.forEach((grp) => {
      const alloc = discountResult.allocations.get(grp.sellerId) || 0;
      grp.discount = alloc;
      grp.total = grp.subtotal + grp.shippingFee + grp.vasFee - grp.discount;
      grp.shareRatio =
        discountResult.totalEligibleSubtotal > 0 && grp.eligibleSubtotal > 0
          ? grp.eligibleSubtotal / discountResult.totalEligibleSubtotal
          : 0;

      subtotal += grp.subtotal;
      shippingTotal += grp.shippingFee;
      vasTotal += grp.vasFee;
      discountTotal += grp.discount;
      grandTotal += grp.total;
    });

    const isValid = blockingErrors.length === 0 && priceChangedAlerts.length === 0 && orderGroups.length > 0;

    return {
      isValid,
      hasPriceChanges: priceChangedAlerts.length > 0,
      blockingErrors,
      priceChangedAlerts,
      orderGroups,
      couponInfo: {
        appliedCoupon: discountResult.appliedCoupon,
        effectiveDiscount: discountResult.effectiveDiscount,
        totalEligibleSubtotal: discountResult.totalEligibleSubtotal,
        reason: discountResult.reason,
      },
      totals: {
        subtotal,
        shippingTotal,
        vasTotal,
        discountTotal,
        grandTotal,
      },
    };
  }

  App.Pricing = {
    isItemEligibleForCoupon,
    allocateDiscountProportionally,
    calculateCheckoutPreview,
  };
})(window.HubApp);
