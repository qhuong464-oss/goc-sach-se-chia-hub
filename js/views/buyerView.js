/* ==========================================================================
   Buyer & Public Marketplace View (PRD v1.2)
   Sub-views: Public Catalog (active only) | Multi-Seller Checkout | My Orders
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  const viewState = {
    subtab: "catalog", // "catalog" | "checkout" | "orders"
    search: "",
    category: "all",
    sellerId: "all",
    sort: "newest",
    orderFilter: "all",
  };

  function setSubtab(tab) {
    viewState.subtab = tab;
  }

  function renderCatalog(state) {
    const { escapeHtml, formatVnd, renderBookCoverSvg } = App.Utils;

    // BR-02: Public catalog strictly filters status === "active"
    const hiddenModerationCount = state.listings.filter(
      (l) => l.status === "pending_review" || l.status === "rejected"
    ).length;

    const categories = Array.from(new Set(state.listings.filter((l) => l.status === "active").map((l) => l.category)));

    let items = state.listings.filter((l) => l.status === "active");
    if (viewState.search.trim()) {
      const q = viewState.search.trim().toLowerCase();
      items = items.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.author.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q)
      );
    }
    if (viewState.category !== "all") {
      items = items.filter((l) => l.category === viewState.category);
    }
    if (viewState.sellerId !== "all") {
      items = items.filter((l) => l.sellerId === viewState.sellerId);
    }

    if (viewState.sort === "price_asc") {
      items = items.slice().sort((a, b) => a.price - b.price);
    } else if (viewState.sort === "price_desc") {
      items = items.slice().sort((a, b) => b.price - a.price);
    }

    return `
      <div class="text-xs muted mb-2">
        Tìm kiếm công khai chỉ hiển thị sách trạng thái <code>active</code> (${items.length} kết quả, đang ẩn <strong>${hiddenModerationCount}</strong> sách chưa duyệt / từ chối). Bấm vào bìa hoặc tên sách để xem chi tiết.
      </div>

      <div class="filter-bar">
        <input type="text" class="input" id="catalogSearchInput" placeholder="Tìm tên sách, tác giả, thể loại..." value="${escapeHtml(viewState.search)}" />
        <select class="select" id="catalogCategorySelect">
          <option value="all">Tất cả thể loại</option>
          ${categories.map((c) => `<option value="${escapeHtml(c)}" ${viewState.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
        <select class="select" id="catalogSellerSelect">
          <option value="all">Tất cả Seller</option>
          ${state.sellers.map((s) => `<option value="${s.id}" ${viewState.sellerId === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
        </select>
        <select class="select" id="catalogSortSelect">
          <option value="newest" ${viewState.sort === "newest" ? "selected" : ""}>Mặc định</option>
          <option value="price_asc" ${viewState.sort === "price_asc" ? "selected" : ""}>Giá thấp → cao</option>
          <option value="price_desc" ${viewState.sort === "price_desc" ? "selected" : ""}>Giá cao → thấp</option>
        </select>
        <button type="button" class="btn btn-outline btn-sm" id="btnResetCatalogFilter">Xóa lọc</button>
      </div>

      ${
        items.length === 0
          ? `<div class="card text-sm muted">Không tìm thấy đầu sách công khai phù hợp (sách chưa duyệt không hiển thị tại đây).</div>`
          : `<div class="books-grid">
              ${items
                .map((book) => {
                  const seller = state.sellers.find((s) => s.id === book.sellerId);
                  const outOfStock = book.stock <= 0;
                  return `
                    <article class="book-card">
                      <div class="book-cover-wrap">
                        <span class="book-condition-pill">${escapeHtml(book.condition)}</span>
                        <span class="book-stock-pill">${outOfStock ? "Hết hàng" : `Còn ${book.stock}`}</span>
                        <div data-open-book="${book.id}" title="Xem chi tiết sách">${renderBookCoverSvg(book)}</div>
                      </div>
                      <div class="book-body">
                        <div class="book-seller-tag">
                          <span>${escapeHtml(seller ? seller.name : book.sellerId)}</span>
                          <span class="badge badge-info">${escapeHtml(book.category)}</span>
                        </div>
                        <h3 class="book-title" data-open-book="${book.id}" title="Xem chi tiết sách">${escapeHtml(book.title)}</h3>
                        <div class="book-author">${escapeHtml(book.author)} • ${escapeHtml(seller ? seller.city : "")}</div>
                        <div class="book-price-row">
                          <span class="book-price">${formatVnd(book.price)}</span>
                          <span class="book-ship-hint">Ship: ${formatVnd(seller ? seller.shippingFee : 0)}</span>
                        </div>
                        <div class="book-actions">
                          <button type="button" class="btn btn-primary btn-sm" style="width:100%" data-add-cart="${book.id}" ${outOfStock ? "disabled" : ""}>
                            ${outOfStock ? "Hết hàng" : "+ Thêm vào giỏ"}
                          </button>
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>`
      }
    `;
  }

  function renderCheckout(state) {
    const { escapeHtml, formatVnd } = App.Utils;
    const preview = App.Pricing.calculateCheckoutPreview(state);

    const scenarioBar = `
      <div class="card card-blue-tint mb-2" style="padding:10px 14px;">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs fw-bold text-blue">Kịch bản kiểm thử nhanh:</span>
          <div class="flex flex-wrap gap-1">
            <button type="button" class="btn btn-xs btn-primary" data-scenario="prd300k">VD PRD (200k + 100k, -30k)</button>
            <button type="button" class="btn btn-xs btn-outline" data-scenario="odd">Chia lẻ 3 Seller (TC-DC03)</button>
            <button type="button" class="btn btn-xs btn-outline" data-scenario="cat">Giới hạn Văn học (TC-DC05)</button>
            <button type="button" class="btn btn-xs btn-outline" data-scenario="pricechange">Test Đổi giá (TC-M04)</button>
            <button type="button" class="btn btn-xs btn-outline" data-scenario="oos">Test Hết hàng (TC-M03)</button>
          </div>
        </div>
      </div>
    `;

    if (state.cart.length === 0) {
      return `
        ${scenarioBar}
        <div class="card">
          <h3>Giỏ hàng đang trống</h3>
          <p class="muted text-sm">Chọn sách từ Sàn hoặc nạp một kịch bản kiểm thử nhanh ở trên.</p>
          <button type="button" class="btn btn-primary btn-sm" data-buyer-subtab="catalog">Quay lại Sàn sách</button>
        </div>
      `;
    }

    const alertsHtml = `
      ${
        preview.blockingErrors.length > 0
          ? `<div class="alert alert-danger">
              <div>
                <strong>Toàn bộ Checkout bị chặn (All-or-Nothing – BR-01):</strong>
                <ul style="margin:4px 0 0 18px;padding:0;">
                  ${preview.blockingErrors.map((err) => `<li>${escapeHtml(err)}</li>`).join("")}
                </ul>
                <div class="text-xs mt-1">Giỏ hàng giữ nguyên, không tạo Order / Escrow / Shipment một phần.</div>
              </div>
              <button type="button" class="btn btn-xs btn-outline" id="btnSyncStockOrRemoveInvalid">Xóa món không hợp lệ</button>
            </div>`
          : ""
      }
      ${
        preview.priceChangedAlerts.length > 0
          ? `<div class="alert alert-warn">
              <div>
                <strong>Phát hiện thay đổi giá sản phẩm (TC-M04):</strong>
                <ul style="margin:4px 0 0 18px;padding:0;">
                  ${preview.priceChangedAlerts
                    .map(
                      (p) =>
                        `<li><strong>${escapeHtml(p.title)}</strong>: giá cũ <s>${formatVnd(p.oldPrice)}</s> → giá mới <strong>${formatVnd(p.newPrice)}</strong></li>`
                    )
                    .join("")}
                </ul>
                <div class="text-xs mt-1">Vui lòng xác nhận lại giá mới trước khi tạo Order snapshot.</div>
              </div>
              <button type="button" class="btn btn-sm btn-warning" id="btnAcceptNewPrices">Đồng ý giá mới</button>
            </div>`
          : ""
      }
    `;

    const groupsHtml = preview.orderGroups
      .map((grp, idx) => {
        const sharePct = (grp.shareRatio * 100).toFixed(1).replace(/\.0$/, "");
        return `
          <div class="seller-group-box">
            <div class="seller-group-head">
              <div>
                <strong>Order dự kiến #${idx + 1} • ${escapeHtml(grp.seller.name)}</strong>
                <div class="text-xs muted">${escapeHtml(grp.seller.city)} • Đơn vị vận chuyển riêng: <strong>${escapeHtml(grp.seller.carrier)}</strong></div>
              </div>
              <span class="badge badge-info">Ship riêng: ${formatVnd(grp.shippingFee)}</span>
            </div>
            <div class="seller-group-body">
              ${grp.lines
                .map(
                  (line) => `
                  <div class="order-line-item">
                    <div style="flex:1">
                      <div class="fw-bold text-sm">${escapeHtml(line.listing.title)}</div>
                      <div class="text-xs muted">
                        ${escapeHtml(line.listing.category)} • ${escapeHtml(line.listing.condition)} • Snapshot: <strong>${formatVnd(line.snapshotUnitPrice)}</strong>
                        ${
                          preview.couponInfo.appliedCoupon
                            ? line.eligibleForCoupon
                              ? `<span class="badge badge-success" style="margin-left:4px;">Đủ ĐK mã</span>`
                              : `<span class="badge badge-warn" style="margin-left:4px;">Ngoài phạm vi mã</span>`
                            : ""
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <button type="button" class="btn-icon" data-qty-delta="-1" data-listing-id="${line.listing.id}">-</button>
                      <span class="fw-bold" style="min-width:24px;text-align:center;">${line.quantity}</span>
                      <button type="button" class="btn-icon" data-qty-delta="1" data-listing-id="${line.listing.id}">+</button>
                    </div>
                    <div class="text-right" style="min-width:95px;">
                      <div class="fw-bold text-blue">${formatVnd(line.lineSubtotal)}</div>
                      <button type="button" class="btn btn-xs btn-outline mt-1" data-remove-cart="${line.listing.id}">Xóa</button>
                    </div>
                  </div>
                `
                )
                .join("")}

              <div class="grid-2 mt-2" style="align-items:center;">
                <div>
                  <label class="form-label">Dịch vụ giá trị gia tăng (VAS riêng Order):</label>
                  <select class="select" data-vas-seller="${grp.sellerId}">
                    ${state.vasOptions
                      .map(
                        (v) =>
                          `<option value="${v.id}" ${grp.vasOption.id === v.id ? "selected" : ""}>${escapeHtml(v.label)}</option>`
                      )
                      .join("")}
                  </select>
                </div>
                <div class="card" style="padding:10px 12px;background:var(--bg-surface-alt);">
                  <div class="summary-row"><span>Tạm tính Order (Subtotal):</span><strong>${formatVnd(grp.subtotal)}</strong></div>
                  <div class="summary-row"><span>Phí vận chuyển riêng (CONF-02):</span><span>${formatVnd(grp.shippingFee)}</span></div>
                  <div class="summary-row"><span>Phí VAS:</span><span>${formatVnd(grp.vasFee)}</span></div>
                  <div class="summary-row text-teal">
                    <span>Phân bổ mã giảm giá ${grp.discount > 0 ? `(${sharePct}%)` : ""}:</span>
                    <strong>-${formatVnd(grp.discount)}</strong>
                  </div>
                  <div class="summary-row total"><span>Thành tiền Order #${idx + 1}:</span><span>${formatVnd(grp.total)}</span></div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const invalidRawItems = state.cart.filter(
      (c) => !preview.orderGroups.some((g) => g.lines.some((l) => l.listing.id === c.listingId))
    );

    const invalidFallbackHtml =
      invalidRawItems.length > 0
        ? `<div class="card mb-2" style="border-color:rgba(185,28,28,0.4);">
            <h4 style="margin:0 0 8px;color:var(--status-danger-text);">Sản phẩm đang gặp lỗi trong giỏ hàng</h4>
            ${invalidRawItems
              .map((ci) => {
                const l = state.listings.find((x) => x.id === ci.listingId);
                return `
                  <div class="order-line-item">
                    <div>
                      <strong>${escapeHtml(l ? l.title : ci.listingId)}</strong>
                      <div class="text-xs muted">Trạng thái: ${escapeHtml(l ? l.status : "missing")} • Kho: ${l ? l.stock : 0} • Yêu cầu: ${ci.quantity}</div>
                    </div>
                    <button type="button" class="btn btn-xs btn-danger-soft" data-remove-cart="${ci.listingId}">Xóa khỏi giỏ</button>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : "";

    return `
      ${scenarioBar}
      ${alertsHtml}
      <div class="checkout-layout">
        <div>
          <div class="card mb-2" style="padding:10px 14px;">
            <div class="card-header" style="margin-bottom:2px;">
              <h3 class="card-title">Phân nhóm theo Seller (${preview.orderGroups.length} Order con trong 1 Checkout Session)</h3>
              <span class="badge badge-teal">${App.HUB_CONFIG.SHIPPING_FEE_MODE}</span>
            </div>
            <p class="text-xs muted" style="margin:0;">Mỗi Seller tương ứng 1 Order, 1 Shipment, 1 Escrow Transaction riêng và phí ship tính độc lập.</p>
          </div>
          ${invalidFallbackHtml}
          ${groupsHtml}
        </div>

        <aside class="card" style="position:sticky;top:112px;">
          <div class="card-header">
            <h3 class="card-title">Tổng Checkout Session</h3>
            <span class="badge badge-sim">${App.HUB_CONFIG.DATA_MODE}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Mã giảm giá (Phân bổ tỷ trọng – CONF-03):</label>
            <select class="select" id="checkoutCouponSelect">
              <option value="">-- Không áp dụng mã --</option>
              ${state.coupons
                .map(
                  (c) =>
                    `<option value="${c.code}" ${state.checkoutDraft.couponCode === c.code ? "selected" : ""}>${c.code} — ${escapeHtml(c.title)}</option>`
                )
                .join("")}
            </select>
            <div class="text-xs muted mt-1">${escapeHtml(preview.couponInfo.reason)}</div>
          </div>

          <div class="summary-row"><span>Tổng giá trị hàng hóa (Subtotal):</span><strong>${formatVnd(preview.totals.subtotal)}</strong></div>
          <div class="summary-row"><span>Tổng phí vận chuyển (${preview.orderGroups.length} Seller):</span><strong>${formatVnd(preview.totals.shippingTotal)}</strong></div>
          <div class="summary-row"><span>Tổng phí VAS:</span><strong>${formatVnd(preview.totals.vasTotal)}</strong></div>
          <div class="summary-row text-teal"><span>Tổng giảm giá phân bổ:</span><strong>-${formatVnd(preview.totals.discountTotal)}</strong></div>
          <div class="summary-row"><span>Phí hoa hồng sàn (PRD 3.1):</span><span>${App.HUB_CONFIG.TRANSACTION_COMMISSION_RATE * 100}%</span></div>
          <div class="summary-row total"><span>Tổng thanh toán Checkout:</span><span>${formatVnd(preview.totals.grandTotal)}</span></div>

          <button type="button" class="btn btn-primary mt-2" style="width:100%;padding:10px;" id="btnSubmitCheckout" ${preview.isValid ? "" : "disabled"}>
            Xác nhận Đặt hàng (${preview.orderGroups.length} Order)
          </button>
        </aside>
      </div>
    `;
  }

  function renderOrders(state) {
    const { escapeHtml, formatVnd, formatDateTime, formatRemainingTime } = App.Utils;

    let orders = state.orders.slice();
    if (viewState.orderFilter === "waiting") {
      orders = orders.filter((o) => o.status === "waiting_confirmation");
    } else if (viewState.orderFilter === "progress") {
      orders = orders.filter((o) => ["pending_seller", "confirmed", "ready_for_pickup", "picked_up", "in_transit", "delivered"].includes(o.status));
    } else if (viewState.orderFilter === "completed") {
      orders = orders.filter((o) => o.status === "completed");
    } else if (viewState.orderFilter === "disputed") {
      orders = orders.filter((o) => o.status === "disputed" || o.status === "refunded");
    }

    return `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div class="subtabs">
          <button type="button" class="subtab-btn ${viewState.orderFilter === "all" ? "active" : ""}" data-order-filter="all">Tất cả (${state.orders.length})</button>
          <button type="button" class="subtab-btn ${viewState.orderFilter === "waiting" ? "active" : ""}" data-order-filter="waiting">Chờ xác nhận 48h (${state.orders.filter((o) => o.status === "waiting_confirmation").length})</button>
          <button type="button" class="subtab-btn ${viewState.orderFilter === "progress" ? "active" : ""}" data-order-filter="progress">Đang giao (${state.orders.filter((o) => ["pending_seller", "confirmed", "ready_for_pickup", "picked_up", "in_transit", "delivered"].includes(o.status)).length})</button>
          <button type="button" class="subtab-btn ${viewState.orderFilter === "completed" ? "active" : ""}" data-order-filter="completed">Hoàn tất (${state.orders.filter((o) => o.status === "completed").length})</button>
          <button type="button" class="subtab-btn ${viewState.orderFilter === "disputed" ? "active" : ""}" data-order-filter="disputed">Tranh chấp / Hoàn tiền (${state.orders.filter((o) => o.status === "disputed" || o.status === "refunded").length})</button>
        </div>
        <div class="text-xs muted">
          Mẹo thuyết trình: Dùng nút <strong>+24 giờ / +48 giờ</strong> trên thanh công cụ để xem đơn <code>waiting_confirmation</code> tự động hoàn tất!
        </div>
      </div>

      ${
        orders.length === 0
          ? `<div class="card text-sm muted">Không có đơn hàng nào trong bộ lọc hiện tại.</div>`
          : orders
              .map((order) => {
                const seller = state.sellers.find((s) => s.id === order.sellerId);
                const items = state.orderItems.filter((oi) => oi.orderId === order.id);
                const escrow = state.escrows.find((e) => e.orderId === order.id);
                const shipment = state.shipments.find((s) => s.orderId === order.id);
                const dispute = state.disputes.find((d) => d.orderId === order.id);
                const statusMeta = App.ORDER_STATUS_META[order.status] || { label: order.status, badge: "badge-info" };
                const escMeta = escrow ? App.ESCROW_STATUS_META[escrow.status] : null;
                const rem = order.status === "waiting_confirmation" ? formatRemainingTime(order.confirmationDeadline, state.mockNowMs) : null;

                return `
                  <article class="card mb-2">
                    <div class="card-header">
                      <div>
                        <div class="flex flex-wrap items-center gap-1">
                          <strong>${order.id}</strong>
                          <span class="badge ${statusMeta.badge}">${escapeHtml(statusMeta.label)}</span>
                          <span class="badge badge-sim">${order.dataType}</span>
                          ${order.adminLocked ? `<span class="badge badge-danger">Admin đang khóa</span>` : ""}
                        </div>
                        <div class="text-xs muted mt-1">
                          Checkout Session: <code>${order.checkoutSessionId}</code> • Seller: <strong>${escapeHtml(seller ? seller.name : order.sellerId)}</strong> •
                          Tạo lúc: ${formatDateTime(order.createdAt)}
                        </div>
                      </div>
                      <div class="text-right">
                        ${
                          rem
                            ? `<div class="countdown-box ${rem.expired ? "expired" : ""}" data-deadline-iso="${order.confirmationDeadline}">
                                Hạn 48h: <span>${rem.text}</span>
                              </div>
                              <div class="text-xs muted mt-1">Hạn chót: ${formatDateTime(order.confirmationDeadline)}</div>`
                            : `<div class="fw-bold text-blue" style="font-size:1rem;">${formatVnd(order.total)}</div>`
                        }
                      </div>
                    </div>

                    <div class="grid-2">
                      <div>
                        <div class="text-xs fw-bold muted mb-1">SẢN PHẨM TRONG ORDER (SNAPSHOT PRICE)</div>
                        ${items
                          .map(
                            (it) => `
                            <div class="order-line-item">
                              <div>
                                <div class="text-sm fw-bold">${escapeHtml(it.snapshotTitle)}</div>
                                <div class="text-xs muted">Tình trạng: ${escapeHtml(it.snapshotCondition)} • SL: ${it.quantity} × ${formatVnd(it.snapshotUnitPrice)}</div>
                              </div>
                              <strong>${formatVnd(it.lineSubtotal)}</strong>
                            </div>
                          `
                          )
                          .join("")}
                      </div>
                      <div class="card" style="background:var(--bg-surface-alt);padding:10px 12px;">
                        <div class="summary-row"><span>Hàng hóa:</span><span>${formatVnd(order.subtotal)}</span></div>
                        <div class="summary-row"><span>Phí ship (${escapeHtml(shipment ? shipment.carrier : "")} • <code>${shipment ? shipment.trackingCode : ""}</code>):</span><span>${formatVnd(order.shippingFee)}</span></div>
                        <div class="summary-row"><span>Phí VAS:</span><span>${formatVnd(order.vasFee)}</span></div>
                        <div class="summary-row text-teal"><span>Giảm giá phân bổ:</span><span>-${formatVnd(order.discount)}</span></div>
                        <div class="summary-row total"><span>Tổng Order:</span><span>${formatVnd(order.total)}</span></div>
                        <div class="flex flex-wrap items-center justify-between gap-1 mt-1">
                          <span class="text-xs muted">Escrow:</span>
                          ${escMeta ? `<span class="badge ${escMeta.badge}">${escMeta.label}</span>` : "--"}
                        </div>
                        ${
                          order.completionSource
                            ? `<div class="text-xs mt-1 text-teal"><strong>Nguồn hoàn tất:</strong> <code>${order.completionSource}</code> (${formatDateTime(order.completedAt)})</div>`
                            : ""
                        }
                      </div>
                    </div>

                    ${
                      dispute
                        ? `<div class="alert ${dispute.status === "resolved_seller" ? "alert-success" : "alert-warn"} mt-2" style="margin-bottom:0;">
                            <div>
                              <strong>Tranh chấp ${dispute.id} (${dispute.status}):</strong> ${escapeHtml(dispute.reason)} — ${escapeHtml(dispute.description)}
                              ${
                                dispute.resolution
                                  ? `<div class="text-xs mt-1"><strong>Phán quyết Admin (${dispute.resolution.adminId}):</strong> <code>${dispute.resolution.decision}</code> — ${escapeHtml(dispute.resolution.reason)}</div>`
                                  : `<div class="text-xs mt-1">Escrow đang đóng băng (<code>simulated_frozen</code>), chờ Admin giải quyết.</div>`
                              }
                            </div>
                          </div>`
                        : ""
                    }

                    ${
                      order.status === "waiting_confirmation"
                        ? `<div class="flex flex-wrap justify-between items-center gap-2 mt-2" style="padding-top:10px;border-top:1px solid var(--border-color);">
                            <span class="text-xs muted">Bắt đầu chờ xác nhận: ${formatDateTime(order.waitingConfirmationAt)} (tự động hoàn tất sau ${App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS} giờ nếu không có tranh chấp).</span>
                            <div class="flex gap-1">
                              <button type="button" class="btn btn-sm btn-danger-soft" data-open-dispute-modal="${order.id}">Mở tranh chấp</button>
                              <button type="button" class="btn btn-sm btn-success" data-buyer-confirm-order="${order.id}">Đã nhận hàng & Hoàn tất</button>
                            </div>
                          </div>`
                        : ""
                    }
                  </article>
                `;
              })
              .join("")
      }
    `;
  }

  function render(state) {
    const waitingCount = state.orders.filter((o) => o.status === "waiting_confirmation").length;
    const cartCount = state.cart.reduce((s, c) => s + c.quantity, 0);

    return `
      <section>
        <div class="page-header">
          <div>
            <h1 class="page-title">Không gian Buyer & Sàn Sách Cũ</h1>
            <p class="page-subtitle">Tìm kiếm sách đã kiểm duyệt, đặt hàng nhiều Seller trong 1 Checkout Session và theo dõi hạn xác nhận 48 giờ.</p>
          </div>
          <div class="subtabs">
            <button type="button" class="subtab-btn ${viewState.subtab === "catalog" ? "active" : ""}" data-buyer-subtab="catalog">Sàn sách công khai</button>
            <button type="button" class="subtab-btn ${viewState.subtab === "checkout" ? "active" : ""}" data-buyer-subtab="checkout">Checkout (${cartCount})</button>
            <button type="button" class="subtab-btn ${viewState.subtab === "orders" ? "active" : ""}" data-buyer-subtab="orders">Đơn hàng của tôi ${waitingCount > 0 ? `(${waitingCount} chờ)` : ""}</button>
          </div>
        </div>

        ${
          viewState.subtab === "catalog"
            ? renderCatalog(state)
            : viewState.subtab === "checkout"
            ? renderCheckout(state)
            : renderOrders(state)
        }
      </section>
    `;
  }

  function bindEvents(root, handlers) {
    root.querySelectorAll("[data-buyer-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewState.subtab = btn.getAttribute("data-buyer-subtab");
        handlers.rerender();
      });
    });

    const searchInput = root.querySelector("#catalogSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        viewState.search = e.target.value;
        handlers.rerenderKeepFocus("catalogSearchInput", e.target.selectionStart);
      });
    }

    const catSel = root.querySelector("#catalogCategorySelect");
    if (catSel) {
      catSel.addEventListener("change", (e) => {
        viewState.category = e.target.value;
        handlers.rerender();
      });
    }

    const sellerSel = root.querySelector("#catalogSellerSelect");
    if (sellerSel) {
      sellerSel.addEventListener("change", (e) => {
        viewState.sellerId = e.target.value;
        handlers.rerender();
      });
    }

    const sortSel = root.querySelector("#catalogSortSelect");
    if (sortSel) {
      sortSel.addEventListener("change", (e) => {
        viewState.sort = e.target.value;
        handlers.rerender();
      });
    }

    const resetBtn = root.querySelector("#btnResetCatalogFilter");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        viewState.search = "";
        viewState.category = "all";
        viewState.sellerId = "all";
        viewState.sort = "newest";
        handlers.rerender();
      });
    }

    root.querySelectorAll("[data-open-book]").forEach((el) => {
      el.addEventListener("click", () => handlers.openBookDetailModal(el.getAttribute("data-open-book")));
    });

    root.querySelectorAll("[data-add-cart]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = App.Store.addToCart(btn.getAttribute("data-add-cart"), 1);
        if (res.ok) handlers.toast(`Đã thêm "${res.listing.title}" vào giỏ hàng.`, "success");
        else handlers.toast(res.error, "error");
      });
    });

    root.querySelectorAll("[data-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-scenario");
        if (key === "prd300k") {
          App.Store.loadPrdExampleCart();
          handlers.toast("Đã nạp giỏ hàng mẫu PRD 2.1 (Seller A 200k + Seller B 100k, mã CHIA30K).", "success");
        } else if (key === "odd") {
          App.Store.loadRoundingOddCart();
          handlers.toast("Đã nạp kịch bản 3 Seller chia mã lẻ LE10K (kiểm tra làm tròn xuống + dồn Order cuối).", "info");
        } else if (key === "cat") {
          App.Store.loadCategoryCouponCart();
          handlers.toast("Đã nạp kịch bản mã giới hạn Văn học (VANHOC20K) với giỏ gồm sách Văn học & Công nghệ.", "info");
        } else if (key === "oos") {
          App.Store.loadOutOfStockDemoCart();
          handlers.toast("Đã mô phỏng 1 sản phẩm hết hàng để minh họa Checkout All-or-Nothing thất bại.", "warn");
        } else if (key === "pricechange") {
          App.Store.loadPriceChangeDemoCart();
          handlers.toast("Đã mô phỏng sản phẩm đổi giá so với lúc thêm vào giỏ (TC-M04).", "warn");
        }
      });
    });

    root.querySelectorAll("[data-qty-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = App.Store.updateCartQty(
          btn.getAttribute("data-listing-id"),
          Number(btn.getAttribute("data-qty-delta"))
        );
        if (res && !res.ok) handlers.toast(res.error, "warn");
      });
    });

    root.querySelectorAll("[data-remove-cart]").forEach((btn) => {
      btn.addEventListener("click", () => {
        App.Store.removeFromCart(btn.getAttribute("data-remove-cart"));
        handlers.toast("Đã xóa sản phẩm khỏi giỏ hàng.", "info");
      });
    });

    root.querySelectorAll("[data-vas-seller]").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        App.Store.setSellerVas(sel.getAttribute("data-vas-seller"), e.target.value);
      });
    });

    const couponSel = root.querySelector("#checkoutCouponSelect");
    if (couponSel) {
      couponSel.addEventListener("change", (e) => {
        App.Store.setCouponCode(e.target.value);
      });
    }

    const acceptPriceBtn = root.querySelector("#btnAcceptNewPrices");
    if (acceptPriceBtn) {
      acceptPriceBtn.addEventListener("click", () => {
        App.Store.syncCartSnapshotPrices();
        handlers.toast("Đã cập nhật snapshot giá mới nhất cho giỏ hàng.", "success");
      });
    }

    const cleanInvalidBtn = root.querySelector("#btnSyncStockOrRemoveInvalid");
    if (cleanInvalidBtn) {
      cleanInvalidBtn.addEventListener("click", () => {
        const s = App.Store.getState();
        s.cart = s.cart.filter((ci) => {
          const l = s.listings.find((x) => x.id === ci.listingId);
          return l && l.status === "active" && l.stock >= ci.quantity;
        });
        App.Store.notify();
        handlers.toast("Đã loại bỏ sản phẩm không đủ điều kiện khỏi giỏ.", "info");
      });
    }

    const submitBtn = root.querySelector("#btnSubmitCheckout");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.executeCheckout(s);
        if (!res.ok) {
          handlers.toast(res.error, "error");
          return;
        }
        App.Store.notify();
        viewState.subtab = "orders";
        handlers.openCheckoutSuccessModal(res.session, res.orders);
      });
    }

    root.querySelectorAll("[data-order-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewState.orderFilter = btn.getAttribute("data-order-filter");
        handlers.rerender();
      });
    });

    root.querySelectorAll("[data-buyer-confirm-order]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.buyerConfirmOrder(s, btn.getAttribute("data-buyer-confirm-order"));
        if (res.ok) {
          App.Store.notify();
          handlers.toast(`${res.order.id} đã hoàn tất (buyer_confirmation). Escrow đã giải ngân mô phỏng!`, "success");
        } else {
          handlers.toast(res.error, "error");
        }
      });
    });

    root.querySelectorAll("[data-open-dispute-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handlers.openDisputeModal(btn.getAttribute("data-open-dispute-modal"));
      });
    });
  }

  App.BuyerView = {
    setSubtab,
    render,
    bindEvents,
  };
})(window.HubApp);
