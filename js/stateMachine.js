/* ==========================================================================
   Centralized State Machine: Checkout, Order, Escrow, Payout, Dispute & Moderation
   PRD v1.2 Sections II, III, IV, VII & VIII
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  function nowIso(state) {
    return new Date(state.mockNowMs).toISOString();
  }

  function addAudit(state, actor, action, detail) {
    state.auditLogs.unshift({
      time: nowIso(state),
      actor,
      action,
      detail,
    });
    if (state.auditLogs.length > 80) {
      state.auditLogs.length = 80;
    }
  }

  function calcSellerPayoutAmount(order) {
    const rate = App.HUB_CONFIG.TRANSACTION_COMMISSION_RATE || 0;
    return Math.round(order.subtotal * (1 - rate));
  }

  function upsertPayout(state, order, fields) {
    let payout = state.payouts.find((p) => p.orderId === order.id);
    if (!payout) {
      state.seqCounter += 1;
      payout = {
        id: App.Utils.nextId("PAY", state.seqCounter),
        orderId: order.id,
        sellerId: order.sellerId,
        amount: fields.amount !== undefined ? fields.amount : calcSellerPayoutAmount(order),
        status: fields.status || "simulated_pending",
        source: fields.source || "buyer_confirmation",
        dataType: "simulated",
      };
      state.payouts.unshift(payout);
    }
    Object.assign(payout, fields);
    return payout;
  }

  /**
   * All-or-Nothing Multi-Seller Checkout (BR-01, Section 3.4)
   */
  function executeCheckout(state) {
    const preview = App.Pricing.calculateCheckoutPreview(state);
    if (!preview.isValid) {
      return {
        ok: false,
        error: preview.blockingErrors[0] || "Giá sản phẩm vừa thay đổi. Vui lòng kiểm tra lại trước khi thanh toán.",
        preview,
      };
    }

    const timestamp = nowIso(state);
    state.seqCounter += 1;
    const sessionId = App.Utils.nextId("CS", state.seqCounter);
    const createdOrders = [];

    preview.orderGroups.forEach((grp) => {
      state.seqCounter += 1;
      const orderId = App.Utils.nextId("ORD", state.seqCounter);
      const itemIds = [];

      grp.lines.forEach((line, idx) => {
        const orderItemId = `OI-${orderId.replace("ORD-", "")}-${idx + 1}`;
        itemIds.push(orderItemId);
        state.orderItems.push({
          id: orderItemId,
          orderId,
          listingId: line.listing.id,
          quantity: line.quantity,
          snapshotUnitPrice: line.snapshotUnitPrice,
          snapshotTitle: line.listing.title,
          snapshotCondition: line.listing.condition,
          lineSubtotal: line.lineSubtotal,
        });

        // Decrement inventory atomically after full validation passed
        line.listing.stock -= line.quantity;
        line.listing.updatedAt = timestamp;
      });

      const order = {
        id: orderId,
        checkoutSessionId: sessionId,
        buyerId: "buyer-01",
        sellerId: grp.sellerId,
        itemIds,
        subtotal: grp.subtotal,
        shippingFee: grp.shippingFee,
        vasFee: grp.vasFee,
        discount: grp.discount,
        total: grp.total,
        status: "pending_seller",
        adminLocked: false,
        dataType: "simulated",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.orders.unshift(order);
      createdOrders.push(order);

      state.shipments.unshift({
        id: `SHP-${orderId.replace("ORD-", "")}`,
        orderId,
        sellerId: grp.sellerId,
        carrier: grp.seller.carrier,
        trackingCode: `SIM-${orderId.replace("ORD-", "")}`,
        shippingFee: grp.shippingFee,
        status: "pending_seller",
        dataType: "simulated",
        updatedAt: timestamp,
      });

      state.escrows.unshift({
        id: `ESC-${orderId.replace("ORD-", "")}`,
        orderId,
        amount: grp.total,
        status: "simulated_held",
        dataType: "simulated",
        updatedAt: timestamp,
      });
    });

    const session = {
      id: sessionId,
      buyerId: "buyer-01",
      orderIds: createdOrders.map((o) => o.id),
      subtotal: preview.totals.subtotal,
      shippingTotal: preview.totals.shippingTotal,
      vasTotal: preview.totals.vasTotal,
      discountTotal: preview.totals.discountTotal,
      grandTotal: preview.totals.grandTotal,
      status: "completed",
      dataType: "simulated",
      createdAt: timestamp,
    };
    state.checkoutSessions.unshift(session);

    // Clear purchased items from cart
    state.cart = [];
    addAudit(
      state,
      "buyer-01",
      "CHECKOUT_COMPLETED",
      `Tạo ${sessionId} gồm ${createdOrders.length} Order (${createdOrders.map((o) => o.id).join(", ")}), GrandTotal = ${App.Utils.formatVnd(session.grandTotal)}.`
    );

    return { ok: true, session, orders: createdOrders };
  }

  function markOrderDeliveredAndWaiting(state, order) {
    const timestamp = nowIso(state);
    const shipment = state.shipments.find((s) => s.orderId === order.id);
    const deadlineMs = state.mockNowMs + App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS * 3600000;
    order.deliveredAt = timestamp;
    order.waitingConfirmationAt = timestamp;
    order.confirmationDeadline = new Date(deadlineMs).toISOString();
    order.status = "waiting_confirmation";
    order.updatedAt = timestamp;
    if (shipment) {
      shipment.status = "delivered";
      shipment.updatedAt = timestamp;
    }
    addAudit(
      state,
      order.sellerId,
      "ORDER_DELIVERED",
      `${order.id} đã giao → chuyển sang waiting_confirmation (Hạn xác nhận: +${App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS}h).`
    );
    return { ok: true, order };
  }

  /**
   * Advances fulfillment status. Moving to delivered automatically enters waiting_confirmation + 48h deadline.
   */
  function advanceOrderStatus(state, orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };

    const meta = App.ORDER_STATUS_META[order.status];
    if (!meta || !meta.next) {
      return { ok: false, error: `Đơn ${orderId} ở trạng thái "${order.status}" không thể chuyển tiếp bước giao vận.` };
    }

    if (meta.next === "delivered" || meta.next === "waiting_confirmation") {
      return markOrderDeliveredAndWaiting(state, order);
    }

    const timestamp = nowIso(state);
    const shipment = state.shipments.find((s) => s.orderId === order.id);
    order.status = meta.next;
    order.updatedAt = timestamp;
    if (shipment) {
      shipment.status = meta.next;
      shipment.updatedAt = timestamp;
    }
    addAudit(state, order.sellerId, "ORDER_STATUS_UPDATED", `${order.id} chuyển trạng thái → ${meta.next}.`);
    return { ok: true, order };
  }

  function fastForwardToDelivered(state, orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    const preDeliveryStatuses = ["pending_seller", "confirmed", "ready_for_pickup", "picked_up", "in_transit"];
    if (!preDeliveryStatuses.includes(order.status)) {
      return { ok: false, error: `Đơn ${orderId} không ở giai đoạn trước khi giao.` };
    }
    return markOrderDeliveredAndWaiting(state, order);
  }

  /**
   * Buyer confirms receipt before 48h deadline.
   */
  function buyerConfirmOrder(state, orderId) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    if (order.status !== "waiting_confirmation") {
      return { ok: false, error: `Đơn ${orderId} phải ở trạng thái waiting_confirmation để Buyer xác nhận.` };
    }
    const activeDispute = state.disputes.find(
      (d) => d.orderId === order.id && (d.status === "open" || d.status === "under_review")
    );
    if (activeDispute) {
      return { ok: false, error: "Đơn đang có tranh chấp mở, không thể xác nhận hoàn tất." };
    }

    const timestamp = nowIso(state);
    order.status = "completed";
    order.completionSource = "buyer_confirmation";
    order.completedAt = timestamp;
    order.updatedAt = timestamp;

    const escrow = state.escrows.find((e) => e.orderId === order.id);
    if (escrow) {
      escrow.status = "simulated_released";
      escrow.releasedAt = timestamp;
      escrow.resolutionSource = "buyer_confirmation";
      escrow.updatedAt = timestamp;
    }

    const payout = upsertPayout(state, order, {
      amount: calcSellerPayoutAmount(order),
      status: "simulated_paid",
      source: "buyer_confirmation",
      paidAt: timestamp,
    });

    addAudit(
      state,
      "buyer-01",
      "BUYER_CONFIRMED",
      `${order.id} hoàn tất theo buyer_confirmation. Escrow giải ngân & Payout ${payout.id} = ${App.Utils.formatVnd(payout.amount)}.`
    );

    return { ok: true, order, payout };
  }

  /**
   * BR-03 Auto Order Completion Engine (48 hours from waitingConfirmationAt).
   */
  function runAutoCompletion(state) {
    const timestamp = nowIso(state);
    const completedIds = [];

    state.orders.forEach((order) => {
      if (order.status !== "waiting_confirmation") return;
      if (!order.confirmationDeadline) return;
      if (state.mockNowMs < Date.parse(order.confirmationDeadline)) return;
      if (order.completedAt) return;
      if (order.adminLocked) return;

      const hasDispute = state.disputes.some(
        (d) => d.orderId === order.id && (d.status === "open" || d.status === "under_review")
      );
      if (hasDispute) return;

      order.status = "completed";
      order.completionSource = "system_auto_completion";
      order.completedAt = timestamp;
      order.updatedAt = timestamp;

      const escrow = state.escrows.find((e) => e.orderId === order.id);
      if (escrow) {
        escrow.status = "simulated_released";
        escrow.releasedAt = timestamp;
        escrow.resolutionSource = "system_auto_completion";
        escrow.updatedAt = timestamp;
      }

      const payout = upsertPayout(state, order, {
        amount: calcSellerPayoutAmount(order),
        status: "simulated_paid",
        source: "system_auto_completion",
        paidAt: timestamp,
      });

      completedIds.push(order.id);
      addAudit(
        state,
        "SYSTEM",
        "AUTO_COMPLETE",
        `${order.id} tự động hoàn tất sau ${App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS}h (system_auto_completion) → Payout ${payout.id} (${App.Utils.formatVnd(payout.amount)}).`
      );
    });

    return completedIds;
  }

  function toggleAdminOrderLock(state, orderId, adminId = "admin-01") {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    order.adminLocked = !order.adminLocked;
    order.updatedAt = nowIso(state);
    addAudit(
      state,
      adminId,
      order.adminLocked ? "ORDER_LOCKED" : "ORDER_UNLOCKED",
      `${order.id} đã ${order.adminLocked ? "bị Admin khóa (tạm dừng auto-complete)" : "được mở khóa"}.`
    );
    return { ok: true, order };
  }

  /**
   * Buyer opens Dispute while in waiting_confirmation.
   */
  function openDispute(state, orderId, reason, description, evidenceInput) {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    if (order.status !== "waiting_confirmation") {
      return { ok: false, error: `Chỉ có thể mở tranh chấp khi đơn ở trạng thái waiting_confirmation.` };
    }
    const existing = state.disputes.find((d) => d.orderId === order.id);
    if (existing) {
      return { ok: false, error: `Đơn ${order.id} đã có hồ sơ tranh chấp (${existing.id}).` };
    }
    if (!reason || !reason.trim() || !description || !description.trim()) {
      return { ok: false, error: "Vui lòng nhập đầy đủ lý do và mô tả tranh chấp." };
    }

    const timestamp = nowIso(state);
    state.seqCounter += 1;
    const disputeId = App.Utils.nextId("DSP", state.seqCounter);
    const evidence = (evidenceInput || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const dispute = {
      id: disputeId,
      orderId: order.id,
      buyerId: order.buyerId,
      reason: reason.trim(),
      description: description.trim(),
      evidence: evidence.length > 0 ? evidence : ["anh-minh-chung-sim.jpg (mô phỏng)"],
      status: "open",
      createdAt: timestamp,
    };
    state.disputes.unshift(dispute);

    order.status = "disputed";
    order.updatedAt = timestamp;

    const escrow = state.escrows.find((e) => e.orderId === order.id);
    if (escrow) {
      escrow.status = "simulated_frozen";
      escrow.updatedAt = timestamp;
    }

    upsertPayout(state, order, {
      amount: calcSellerPayoutAmount(order),
      status: "simulated_pending",
      source: "admin_resolution",
    });

    addAudit(
      state,
      "buyer-01",
      "DISPUTE_OPENED",
      `Mở tranh chấp ${disputeId} cho ${order.id} ("${dispute.reason}"). Escrow đóng băng (simulated_frozen), tạm dừng Payout.`
    );

    return { ok: true, dispute };
  }

  function adminSetDisputeUnderReview(state, disputeId, adminId = "admin-01") {
    const dispute = state.disputes.find((d) => d.id === disputeId);
    if (!dispute) return { ok: false, error: "Không tìm thấy tranh chấp." };
    if (dispute.status !== "open") {
      return { ok: false, error: "Chỉ tranh chấp đang mở (open) mới chuyển sang under_review." };
    }
    dispute.status = "under_review";
    addAudit(state, adminId, "DISPUTE_UNDER_REVIEW", `${dispute.id} chuyển sang trạng thái under_review.`);
    return { ok: true, dispute };
  }

  /**
   * BR-04 Dispute Resolution: Admin only, two outcomes, strictly single-resolution.
   */
  function adminResolveDispute(state, disputeId, decision, adminId, reason, actorRole) {
    if (actorRole !== "admin") {
      return {
        ok: false,
        error: "Từ chối truy cập (BR-04): Chỉ Admin có quyền phán quyết tranh chấp. Seller/Buyer không được tự xử lý.",
      };
    }

    const dispute = state.disputes.find((d) => d.id === disputeId);
    if (!dispute) return { ok: false, error: "Không tìm thấy hồ sơ tranh chấp." };

    if (dispute.status === "resolved_buyer" || dispute.status === "resolved_seller" || dispute.resolution) {
      return {
        ok: false,
        error: `Ngăn xử lý trùng (TC-D05): Tranh chấp ${dispute.id} đã được giải quyết trước đó (${dispute.status}).`,
      };
    }

    if (decision !== "refund_buyer" && decision !== "complete_order") {
      return { ok: false, error: "Phương án xử lý tranh chấp không hợp lệ." };
    }

    if (!reason || !reason.trim()) {
      return { ok: false, error: "Admin cần nhập lý do phán quyết để lưu vào lịch sử kiểm tra." };
    }

    const order = state.orders.find((o) => o.id === dispute.orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng liên quan." };
    const escrow = state.escrows.find((e) => e.orderId === order.id);
    const timestamp = nowIso(state);

    dispute.resolution = {
      decision,
      adminId: adminId || "admin-01",
      reason: reason.trim(),
      resolvedAt: timestamp,
    };

    if (decision === "refund_buyer") {
      dispute.status = "resolved_buyer";
      order.status = "refunded";
      order.updatedAt = timestamp;

      if (escrow) {
        escrow.status = "simulated_refunded";
        escrow.refundedAt = timestamp;
        escrow.resolutionSource = "admin_resolution";
        escrow.updatedAt = timestamp;
      }

      upsertPayout(state, order, {
        amount: 0,
        status: "simulated_refunded",
        source: "admin_resolution",
      });

      addAudit(
        state,
        adminId || "admin-01",
        "DISPUTE_REFUND_BUYER",
        `${dispute.id} (${order.id}) → resolved_buyer. Escrow simulated_refunded, Payout simulated_refunded (0đ cho Seller).`
      );
    } else {
      dispute.status = "resolved_seller";
      order.status = "completed";
      order.completionSource = "admin_resolution";
      order.completedAt = timestamp;
      order.updatedAt = timestamp;

      if (escrow) {
        escrow.status = "simulated_released";
        escrow.releasedAt = timestamp;
        escrow.resolutionSource = "admin_resolution";
        escrow.updatedAt = timestamp;
      }

      const payout = upsertPayout(state, order, {
        amount: calcSellerPayoutAmount(order),
        status: "simulated_paid",
        source: "admin_resolution",
        paidAt: timestamp,
      });

      addAudit(
        state,
        adminId || "admin-01",
        "DISPUTE_COMPLETE_ORDER",
        `${dispute.id} (${order.id}) → resolved_seller. Order completed, Payout ${payout.id} = ${App.Utils.formatVnd(payout.amount)}.`
      );
    }

    return { ok: true, dispute, order };
  }

  /**
   * BR-02 Listing Moderation
   */
  function sellerCreateListing(state, sellerId, payload) {
    if (!payload.title || !payload.title.trim()) {
      return { ok: false, error: "Tên sách không được để trống." };
    }
    const price = Number(payload.price);
    const stock = Number(payload.stock);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: "Giá bán phải lớn hơn 0đ." };
    }
    if (!Number.isInteger(stock) || stock <= 0) {
      return { ok: false, error: "Số lượng tồn kho phải là số nguyên dương." };
    }

    state.seqCounter += 1;
    const id = `lst-${state.seqCounter}`;
    const timestamp = nowIso(state);
    const palettes = [
      ["#315B7D", "#FFD483"],
      ["#0C6980", "#FAF7EF"],
      ["#244763", "#FFC2C2"],
    ];

    const listing = {
      id,
      sellerId,
      title: payload.title.trim(),
      author: (payload.author || "Chưa rõ tác giả").trim(),
      category: payload.category || "Văn học",
      condition: payload.condition || "Tốt (90%)",
      price: Math.round(price),
      stock,
      isbn: (payload.isbn || "N/A").trim(),
      description: (payload.description || "Sách cũ đã kiểm tra tình trạng trang và gáy.").trim(),
      status: "pending_review", // BR-02: Default always pending_review
      coverPalette: palettes[state.seqCounter % palettes.length],
      moderation: {
        listingId: id,
        submittedAt: timestamp,
        decision: "pending",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    state.listings.unshift(listing);
    addAudit(state, sellerId, "LISTING_CREATED", `Đăng bán "${listing.title}" (${id}) ở trạng thái mặc định pending_review.`);
    return { ok: true, listing };
  }

  function sellerEditListing(state, listingId, patch, actorRole) {
    const listing = state.listings.find((l) => l.id === listingId);
    if (!listing) return { ok: false, error: "Không tìm thấy Listing." };
    if (patch.title !== undefined && !patch.title.trim()) {
      return { ok: false, error: "Tên sách không được để trống." };
    }
    if (patch.price !== undefined && (!Number.isFinite(Number(patch.price)) || Number(patch.price) <= 0)) {
      return { ok: false, error: "Giá bán phải lớn hơn 0đ." };
    }
    if (patch.stock !== undefined && (!Number.isFinite(Number(patch.stock)) || Number(patch.stock) < 0)) {
      return { ok: false, error: "Số lượng tồn kho không hợp lệ." };
    }

    const criticalChanged =
      (patch.title !== undefined && patch.title.trim() !== listing.title) ||
      (patch.price !== undefined && Math.round(Number(patch.price)) !== listing.price) ||
      (patch.condition !== undefined && patch.condition !== listing.condition) ||
      (patch.description !== undefined && patch.description.trim() !== listing.description);

    if (patch.title !== undefined) listing.title = patch.title.trim();
    if (patch.author !== undefined) listing.author = patch.author.trim();
    if (patch.category !== undefined) listing.category = patch.category;
    if (patch.condition !== undefined) listing.condition = patch.condition;
    if (patch.price !== undefined) listing.price = Math.round(Number(patch.price));
    if (patch.stock !== undefined) listing.stock = Math.max(0, Math.round(Number(patch.stock)));
    if (patch.description !== undefined) listing.description = patch.description.trim();

    const timestamp = nowIso(state);
    listing.updatedAt = timestamp;

    // BR-02: Critical edits on active/rejected listings require moderation review
    if (criticalChanged && actorRole === "seller") {
      listing.status = "pending_review";
      listing.moderation = {
        listingId: listing.id,
        submittedAt: timestamp,
        decision: "pending",
      };
      addAudit(
        state,
        listing.sellerId,
        "LISTING_RE_MODERATE",
        `Chỉnh sửa thông tin quan trọng trên ${listing.id} ("${listing.title}") → chuyển về pending_review để Admin duyệt lại.`
      );
    }

    return { ok: true, listing, reModerated: criticalChanged && actorRole === "seller" };
  }

  function adminModerateListing(state, listingId, decision, adminId, rejectionReason, actorRole) {
    if (actorRole !== "admin") {
      return {
        ok: false,
        error: "Từ chối (BR-02): Seller không được tự phê duyệt Listing. Chỉ Admin mới có quyền duyệt.",
      };
    }

    const listing = state.listings.find((l) => l.id === listingId);
    if (!listing) return { ok: false, error: "Không tìm thấy Listing." };
    const timestamp = nowIso(state);

    if (decision === "approved") {
      listing.status = "active";
      listing.moderation = {
        listingId: listing.id,
        submittedAt: (listing.moderation && listing.moderation.submittedAt) || listing.createdAt,
        reviewedAt: timestamp,
        reviewedBy: adminId || "admin-01",
        decision: "approved",
      };
      listing.updatedAt = timestamp;
      addAudit(state, adminId || "admin-01", "LISTING_APPROVED", `Phê duyệt ${listing.id} ("${listing.title}") → active công khai.`);
      return { ok: true, listing };
    }

    if (decision === "rejected") {
      if (!rejectionReason || !rejectionReason.trim()) {
        return { ok: false, error: "Khi từ chối Listing phải ghi rõ lý do từ chối." };
      }
      listing.status = "rejected";
      listing.moderation = {
        listingId: listing.id,
        submittedAt: (listing.moderation && listing.moderation.submittedAt) || listing.createdAt,
        reviewedAt: timestamp,
        reviewedBy: adminId || "admin-01",
        decision: "rejected",
        rejectionReason: rejectionReason.trim(),
      };
      listing.updatedAt = timestamp;
      addAudit(state, adminId || "admin-01", "LISTING_REJECTED", `Từ chối ${listing.id} ("${listing.title}"): ${rejectionReason.trim()}`);
      return { ok: true, listing };
    }

    return { ok: false, error: "Quyết định kiểm duyệt không hợp lệ." };
  }

  App.StateMachine = {
    calcSellerPayoutAmount,
    executeCheckout,
    advanceOrderStatus,
    fastForwardToDelivered,
    buyerConfirmOrder,
    runAutoCompletion,
    toggleAdminOrderLock,
    openDispute,
    adminSetDisputeUnderReview,
    adminResolveDispute,
    sellerCreateListing,
    sellerEditListing,
    adminModerateListing,
  };
})(window.HubApp);
