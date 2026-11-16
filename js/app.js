/* ==========================================================================
   Main Application Bootstrap, Modals, Cart Drawer, Theme & Live Clock
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  let activeTab = "buyer"; // "buyer" | "seller" | "admin" | "demolab"

  function toast(message, type = "info") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 4500);
  }

  function updateThemeUi(theme) {
    const label = document.getElementById("themeLabel");
    if (label) {
      label.textContent = theme === "dark" ? "Chế độ Sáng" : "Chế độ Tối";
    }
  }

  function updateHeaderBadges(state) {
    const cartCount = state.cart.reduce((sum, c) => sum + c.quantity, 0);
    const seller = state.sellers.find((s) => s.id === state.activeSellerId) || state.sellers[0];
    const sellerPendingOrders = state.orders.filter(
      (o) => o.sellerId === seller.id && ["pending_seller", "confirmed", "ready_for_pickup", "picked_up", "in_transit"].includes(o.status)
    ).length;
    const sellerRejected = state.listings.filter((l) => l.sellerId === seller.id && l.status === "rejected").length;

    const adminModQueue = state.listings.filter((l) => l.status === "pending_review").length;
    const adminDisputeQueue = state.disputes.filter((d) => d.status === "open" || d.status === "under_review").length;

    const badgeCart = document.getElementById("badgeCartCount");
    const headerCart = document.getElementById("headerCartBadge");
    const badgeSeller = document.getElementById("badgeSellerAlerts");
    const badgeAdmin = document.getElementById("badgeAdminQueue");

    if (badgeCart) badgeCart.textContent = String(cartCount);
    if (headerCart) headerCart.textContent = String(cartCount);
    if (badgeSeller) badgeSeller.textContent = String(sellerPendingOrders + sellerRejected);
    if (badgeAdmin) badgeAdmin.textContent = String(adminModQueue + adminDisputeQueue);

    const clockEl = document.getElementById("mockClockLabel");
    if (clockEl) {
      clockEl.textContent = App.Utils.formatDateTime(new Date(state.mockNowMs).toISOString());
    }

    document.querySelectorAll(".role-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === activeTab);
    });
  }

  function renderCartDrawer(state) {
    const body = document.getElementById("cartDrawerBody");
    const footer = document.getElementById("cartDrawerFooter");
    if (!body || !footer) return;

    const { escapeHtml, formatVnd } = App.Utils;
    const preview = App.Pricing.calculateCheckoutPreview(state);

    if (state.cart.length === 0) {
      body.innerHTML = `<p class="text-sm muted">Giỏ hàng đang trống. Chọn sách từ sàn hoặc nạp kịch bản mẫu trong trang Checkout.</p>`;
      footer.innerHTML = `<button type="button" class="btn btn-primary" style="width:100%;" id="drawerGoCatalogBtn">Khám phá sách cũ</button>`;
      const goCat = document.getElementById("drawerGoCatalogBtn");
      if (goCat) {
        goCat.addEventListener("click", () => {
          closeCartDrawer();
          activeTab = "buyer";
          App.BuyerView.setSubtab("catalog");
          render();
        });
      }
      return;
    }

    body.innerHTML = `
      ${
        preview.blockingErrors.length > 0 || preview.hasPriceChanges
          ? `<div class="alert alert-warn text-xs">${escapeHtml(preview.blockingErrors[0] || "Có sản phẩm vừa thay đổi giá. Mở trang Checkout để kiểm tra.")}</div>`
          : ""
      }
      ${preview.orderGroups
        .map(
          (grp) => `
        <div class="seller-group-box">
          <div class="seller-group-head">
            <strong class="text-sm">${escapeHtml(grp.seller.name)}</strong>
            <span class="text-xs text-blue fw-bold">Ship: ${formatVnd(grp.shippingFee)}</span>
          </div>
          <div class="seller-group-body">
            ${grp.lines
              .map(
                (line) => `
              <div class="order-line-item">
                <div style="flex:1">
                  <div class="text-sm fw-bold">${escapeHtml(line.listing.title)}</div>
                  <div class="text-xs muted">${formatVnd(line.snapshotUnitPrice)} × ${line.quantity}</div>
                </div>
                <div class="flex items-center gap-1">
                  <button type="button" class="btn-icon" data-drawer-qty="-1" data-id="${line.listing.id}">-</button>
                  <span>${line.quantity}</span>
                  <button type="button" class="btn-icon" data-drawer-qty="1" data-id="${line.listing.id}">+</button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("")}
    `;

    footer.innerHTML = `
      <div class="summary-row"><span>Tạm tính sách:</span><strong>${formatVnd(preview.totals.subtotal)}</strong></div>
      <div class="summary-row"><span>Tổng ship (${preview.orderGroups.length} Seller):</span><strong>${formatVnd(preview.totals.shippingTotal)}</strong></div>
      <div class="summary-row text-teal"><span>Giảm giá phân bổ:</span><strong>-${formatVnd(preview.totals.discountTotal)}</strong></div>
      <div class="summary-row total"><span>Dự kiến thanh toán:</span><span>${formatVnd(preview.totals.grandTotal)}</span></div>
      <button type="button" class="btn btn-primary mt-2" style="width:100%;" id="drawerProceedCheckout">Đi tới trang Multi-Seller Checkout →</button>
    `;

    body.querySelectorAll("[data-drawer-qty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = App.Store.updateCartQty(btn.getAttribute("data-id"), Number(btn.getAttribute("data-drawer-qty")));
        if (res && !res.ok) toast(res.error, "warn");
      });
    });

    const proceedBtn = document.getElementById("drawerProceedCheckout");
    if (proceedBtn) {
      proceedBtn.addEventListener("click", () => {
        closeCartDrawer();
        activeTab = "buyer";
        App.BuyerView.setSubtab("checkout");
        render();
      });
    }
  }

  function openCartDrawer() {
    const el = document.getElementById("cartDrawerBackdrop");
    if (el) {
      renderCartDrawer(App.Store.getState());
      el.classList.remove("hidden");
    }
  }

  function closeCartDrawer() {
    const el = document.getElementById("cartDrawerBackdrop");
    if (el) el.classList.add("hidden");
  }

  // ---------- Modal System ----------
  function showModal(title, bodyHtml, footerHtml) {
    const backdrop = document.getElementById("modalBackdrop");
    const tEl = document.getElementById("modalTitle");
    const bEl = document.getElementById("modalBody");
    const fEl = document.getElementById("modalFooter");
    if (!backdrop || !tEl || !bEl || !fEl) return;
    tEl.textContent = title;
    bEl.innerHTML = bodyHtml;
    fEl.innerHTML = footerHtml;
    backdrop.classList.remove("hidden");
  }

  function closeModal() {
    const backdrop = document.getElementById("modalBackdrop");
    if (backdrop) backdrop.classList.add("hidden");
  }

  function openBookDetailModal(listingId) {
    const state = App.Store.getState();
    const { escapeHtml, formatVnd, renderBookCoverSvg } = App.Utils;
    const book = state.listings.find((l) => l.id === listingId);
    if (!book) return;
    const seller = state.sellers.find((s) => s.id === book.sellerId);

    showModal(
      book.title,
      `
        <div class="grid-2" style="grid-template-columns:140px 1fr;align-items:start;">
          <div style="display:flex;justify-content:center;">${renderBookCoverSvg(book)}</div>
          <div>
            <div class="flex flex-wrap gap-1 mb-1">
              <span class="badge badge-info">${escapeHtml(book.category)}</span>
              <span class="badge badge-warn">${escapeHtml(book.condition)}</span>
              <span class="badge badge-success">Còn ${book.stock} cuốn</span>
            </div>
            <p class="text-sm muted" style="margin:6px 0;">Tác giả: <strong>${escapeHtml(book.author)}</strong> • ISBN: <code>${escapeHtml(book.isbn)}</code></p>
            <p class="text-sm" style="margin:8px 0;">${escapeHtml(book.description)}</p>
            <div class="card" style="background:var(--bg-surface-alt);padding:10px 12px;">
              <div class="text-sm"><strong>Người bán:</strong> ${escapeHtml(seller ? seller.name : "")} (${escapeHtml(seller ? seller.city : "")})</div>
              <div class="text-xs muted">Vận chuyển riêng: ${escapeHtml(seller ? seller.carrier : "")} — <strong>${formatVnd(seller ? seller.shippingFee : 0)}</strong> / Order</div>
            </div>
            <div class="mt-2 fw-bold text-blue" style="font-size:1.15rem;">${formatVnd(book.price)}</div>
          </div>
        </div>
      `,
      `
        <div class="flex justify-between gap-2">
          <button type="button" class="btn btn-outline" id="modalCloseBtn">Đóng</button>
          <button type="button" class="btn btn-primary" id="modalAddCartBtn" ${book.stock <= 0 ? "disabled" : ""}>+ Thêm vào giỏ hàng</button>
        </div>
      `
    );

    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalAddCartBtn").addEventListener("click", () => {
      const res = App.Store.addToCart(book.id, 1);
      if (res.ok) {
        closeModal();
        toast(`Đã thêm "${book.title}" vào giỏ hàng.`, "success");
      } else {
        toast(res.error, "error");
      }
    });
  }

  function openCheckoutSuccessModal(session, orders) {
    const state = App.Store.getState();
    const { escapeHtml, formatVnd } = App.Utils;

    showModal(
      `Checkout Thành Công (${session.id})`,
      `
        <div class="alert alert-success">
          <div>
            <strong>Đã tạo 1 Checkout Session & ${orders.length} Order con tách biệt theo từng Seller (BR-01)!</strong>
            <div class="text-xs mt-1">Mỗi Order đã tự động sinh 1 Shipment và 1 Escrow Transaction (<code>simulated_held</code>) riêng.</div>
          </div>
        </div>
        ${orders
          .map((o) => {
            const seller = state.sellers.find((s) => s.id === o.sellerId);
            const shp = state.shipments.find((x) => x.orderId === o.id);
            const esc = state.escrows.find((x) => x.orderId === o.id);
            return `
              <div class="card mb-1" style="padding:10px 12px;background:var(--bg-surface-alt);">
                <div class="flex justify-between items-center">
                  <strong>${o.id} — ${escapeHtml(seller ? seller.name : o.sellerId)}</strong>
                  <strong class="text-blue">${formatVnd(o.total)}</strong>
                </div>
                <div class="text-xs muted mt-1">
                  Hàng: ${formatVnd(o.subtotal)} • Ship riêng: ${formatVnd(o.shippingFee)} • VAS: ${formatVnd(o.vasFee)} • Giảm phân bổ: -${formatVnd(o.discount)}
                </div>
                <div class="text-xs mt-1">
                  Shipment: <code>${shp ? shp.id : ""}</code> (${shp ? shp.trackingCode : ""}) •
                  Escrow: <code>${esc ? esc.id : ""}</code> (<code>${esc ? esc.status : ""}</code>)
                </div>
              </div>
            `;
          })
          .join("")}
        <div class="summary-row total mt-2">
          <span>Tổng Checkout Session (${session.id}):</span>
          <span>${formatVnd(session.grandTotal)}</span>
        </div>
      `,
      `
        <div class="flex justify-between gap-2">
          <button type="button" class="btn btn-outline" id="modalGoSellerBtn">Qua Seller Center xử lý giao hàng</button>
          <button type="button" class="btn btn-primary" id="modalDoneOrdersBtn">Xem đơn hàng của tôi</button>
        </div>
      `
    );

    document.getElementById("modalDoneOrdersBtn").addEventListener("click", closeModal);
    document.getElementById("modalGoSellerBtn").addEventListener("click", () => {
      closeModal();
      activeTab = "seller";
      render();
    });
  }

  function openDisputeModal(orderId) {
    showModal(
      `Mở tranh chấp cho đơn ${orderId}`,
      `
        <form id="openDisputeForm">
          <div class="alert alert-warn text-xs">
            Khi mở tranh chấp, Escrow của đơn sẽ bị đóng băng (<code>simulated_frozen</code>) và hệ thống sẽ <strong>không</strong> tự động hoàn tất sau 48h cho tới khi Admin phán quyết.
          </div>
          <div class="form-group">
            <label class="form-label">Lý do tranh chấp *</label>
            <select class="select" name="reason" required>
              <option value="Sách không đúng tình trạng mô tả">Sách không đúng tình trạng mô tả</option>
              <option value="Thiếu trang / Rách nặng không báo trước">Thiếu trang / Rách nặng không báo trước</option>
              <option value="Giao nhầm đầu sách hoặc ấn bản">Giao nhầm đầu sách hoặc ấn bản</option>
              <option value="Hư hỏng trong quá trình vận chuyển">Hư hỏng trong quá trình vận chuyển</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả chi tiết *</label>
            <textarea class="textarea" name="description" rows="3" required placeholder="Mô tả cụ thể vấn đề gặp phải..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Tên file minh chứng mô phỏng (ngăn cách bằng dấu phẩy)</label>
            <input class="input" name="evidence" value="anh-bia-rach.jpg, video-mo-hop.mp4" />
          </div>
        </form>
      `,
      `
        <div class="flex justify-between gap-2">
          <button type="button" class="btn btn-outline" id="modalCancelDispute">Hủy</button>
          <button type="button" class="btn btn-danger" id="modalSubmitDispute">Gửi tranh chấp & Đóng băng Escrow</button>
        </div>
      `
    );

    document.getElementById("modalCancelDispute").addEventListener("click", closeModal);
    document.getElementById("modalSubmitDispute").addEventListener("click", () => {
      const form = document.getElementById("openDisputeForm");
      const fd = new FormData(form);
      const s = App.Store.getState();
      const res = App.StateMachine.openDispute(
        s,
        orderId,
        fd.get("reason"),
        fd.get("description"),
        fd.get("evidence")
      );
      if (res.ok) {
        App.Store.notify();
        closeModal();
        toast(`Đã mở tranh chấp ${res.dispute.id}. Escrow đơn ${orderId} đã chuyển simulated_frozen.`, "warn");
      } else {
        toast(res.error, "error");
      }
    });
  }

  function openEditListingModal(listingId) {
    const s = App.Store.getState();
    const { escapeHtml } = App.Utils;
    const item = s.listings.find((l) => l.id === listingId);
    if (!item) return;

    showModal(
      `Chỉnh sửa sách (${item.id})`,
      `
        <form id="editListingForm">
          ${
            item.status === "active"
              ? `<div class="alert alert-warn text-xs"><strong>Chính sách BR-02:</strong> Thay đổi tên, giá, tình trạng hoặc mô tả trên sách đang <code>active</code> sẽ tự động chuyển về <code>pending_review</code> để Admin kiểm duyệt lại.</div>`
              : ""
          }
          <div class="form-group">
            <label class="form-label">Tên sách *</label>
            <input class="input" name="title" required value="${escapeHtml(item.title)}" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Giá bán (đ) *</label>
              <input class="input" type="number" name="price" min="1000" step="1000" required value="${item.price}" />
            </div>
            <div class="form-group">
              <label class="form-label">Tồn kho *</label>
              <input class="input" type="number" name="stock" min="0" required value="${item.stock}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tình trạng</label>
            <select class="select" name="condition">
              <option value="Như mới (95%)" ${item.condition.includes("95") ? "selected" : ""}>Như mới (95%)</option>
              <option value="Tốt (90%)" ${item.condition.includes("90") ? "selected" : ""}>Tốt (90%)</option>
              <option value="Khá (82%)" ${item.condition.includes("82") ? "selected" : ""}>Khá (82%)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả</label>
            <textarea class="textarea" name="description" rows="2">${escapeHtml(item.description)}</textarea>
          </div>
        </form>
      `,
      `
        <div class="flex justify-between gap-2">
          <button type="button" class="btn btn-outline" id="modalCancelEdit">Hủy</button>
          <button type="button" class="btn btn-primary" id="modalSaveEdit">Lưu thay đổi</button>
        </div>
      `
    );

    document.getElementById("modalCancelEdit").addEventListener("click", closeModal);
    document.getElementById("modalSaveEdit").addEventListener("click", () => {
      const fd = new FormData(document.getElementById("editListingForm"));
      const res = App.StateMachine.sellerEditListing(
        s,
        item.id,
        {
          title: fd.get("title"),
          price: fd.get("price"),
          stock: fd.get("stock"),
          condition: fd.get("condition"),
          description: fd.get("description"),
        },
        "seller"
      );
      if (res.ok) {
        App.Store.notify();
        closeModal();
        toast(
          res.reModerated
            ? `Đã lưu chỉnh sửa và chuyển "${res.listing.title}" về pending_review theo BR-02.`
            : `Đã cập nhật thông tin "${res.listing.title}".`,
          res.reModerated ? "warn" : "success"
        );
      } else {
        toast(res.error, "error");
      }
    });
  }

  function openRejectListingModal(listingId) {
    const s = App.Store.getState();
    const { escapeHtml } = App.Utils;
    const item = s.listings.find((l) => l.id === listingId);
    if (!item) return;

    showModal(
      `Từ chối Listing: ${item.title}`,
      `
        <form id="rejectListingForm">
          <p class="text-sm muted">Lý do từ chối sẽ được lưu vào <code>ListingModeration</code> và hiển thị trực tiếp cho Seller (HUB-042).</p>
          <div class="form-group">
            <label class="form-label">Lý do từ chối *</label>
            <textarea class="textarea" name="reason" rows="3" required placeholder="VD: Ảnh chụp bìa mờ, chưa rõ tình trạng gáy sách hoặc nghi ngờ sách in lậu...">${escapeHtml("Sách chưa đính kèm thông tin ISBN/tình trạng thực tế rõ ràng, vui lòng bổ sung.")}</textarea>
          </div>
        </form>
      `,
      `
        <div class="flex justify-between gap-2">
          <button type="button" class="btn btn-outline" id="modalCancelReject">Hủy</button>
          <button type="button" class="btn btn-danger" id="modalConfirmReject">Xác nhận Từ chối Listing</button>
        </div>
      `
    );

    document.getElementById("modalCancelReject").addEventListener("click", closeModal);
    document.getElementById("modalConfirmReject").addEventListener("click", () => {
      const fd = new FormData(document.getElementById("rejectListingForm"));
      const res = App.StateMachine.adminModerateListing(
        s,
        listingId,
        "rejected",
        "admin-01",
        fd.get("reason"),
        "admin"
      );
      if (res.ok) {
        App.Store.notify();
        closeModal();
        toast(`Đã từ chối "${res.listing.title}" và gửi lý do tới Seller Center.`, "warn");
      } else {
        toast(res.error, "error");
      }
    });
  }

  function openResolveDisputeModal(disputeId, decision) {
    const isRefund = decision === "refund_buyer";
    showModal(
      isRefund ? `Phán quyết A: Hoàn tiền Buyer (${disputeId})` : `Phán quyết B: Hoàn tất đơn cho Seller (${disputeId})`,
      `
        <form id="resolveDisputeForm">
          <div class="alert ${isRefund ? "alert-danger" : "alert-success"} text-xs">
            ${
              isRefund
                ? "Hệ thống sẽ cập nhật: Dispute → <code>resolved_buyer</code>, Order → <code>refunded</code>, Escrow → <code>simulated_refunded</code>, Payout → <code>simulated_refunded</code> (không thanh toán cho Seller)."
                : "Hệ thống sẽ cập nhật: Dispute → <code>resolved_seller</code>, Order → <code>completed</code>, Escrow → <code>simulated_released</code>, Payout → <code>simulated_paid</code>."
            }
          </div>
          <div class="form-group">
            <label class="form-label">Lý do phán quyết của Admin (bắt buộc) *</label>
            <textarea class="textarea" name="reason" rows="3" required>${
              isRefund
                ? "Đối chiếu bằng chứng xác thực sách không đúng mô tả đã đăng. Chấp thuận hoàn tiền Buyer."
                : "Bằng chứng cho thấy Seller giao đúng sách và đóng gói đạt chuẩn. Hoàn tất giải ngân cho Seller."
            }</textarea>
          </div>
        </form>
      `,
      `
        <div class="flex justify-between gap-2">
          <button type="button" class="btn btn-outline" id="modalCancelResolve">Hủy</button>
          <button type="button" class="btn ${isRefund ? "btn-danger" : "btn-success"}" id="modalConfirmResolve">Xác nhận Phán quyết cuối cùng</button>
        </div>
      `
    );

    document.getElementById("modalCancelResolve").addEventListener("click", closeModal);
    document.getElementById("modalConfirmResolve").addEventListener("click", () => {
      const fd = new FormData(document.getElementById("resolveDisputeForm"));
      const s = App.Store.getState();
      const res = App.StateMachine.adminResolveDispute(
        s,
        disputeId,
        decision,
        "admin-01",
        fd.get("reason"),
        "admin"
      );
      if (res.ok) {
        App.Store.notify();
        closeModal();
        toast(`Đã xử lý tranh chấp ${disputeId} theo phương án "${decision}".`, "success");
      } else {
        toast(res.error, "error");
      }
    });
  }

  function setBrandLogo(src) {
    const img = document.getElementById("brandLogoImg");
    if (img) img.src = src;
    const iconLink = document.querySelector('link[rel="icon"]');
    if (iconLink) iconLink.setAttribute("href", src);
    try {
      localStorage.setItem("goc_sach_se_chia_logo", src);
    } catch (e) {}
  }

  // ---------- Main Render Loop ----------
  const handlers = {
    rerender: render,
    rerenderKeepFocus: (elementId, caretPos) => {
      render();
      const el = document.getElementById(elementId);
      if (el) {
        el.focus();
        if (typeof caretPos === "number" && el.setSelectionRange) {
          el.setSelectionRange(caretPos, caretPos);
        }
      }
    },
    toast,
    setBrandLogo,
    openBookDetailModal,
    openCheckoutSuccessModal,
    openDisputeModal,
    openEditListingModal,
    openRejectListingModal,
    openResolveDisputeModal,
  };

  function render() {
    const state = App.Store.getState();
    const viewport = document.getElementById("mainViewport");
    if (!viewport) return;

    updateHeaderBadges(state);

    if (activeTab === "buyer") {
      viewport.innerHTML = App.BuyerView.render(state);
      App.BuyerView.bindEvents(viewport, handlers);
    } else if (activeTab === "seller") {
      viewport.innerHTML = App.SellerView.render(state);
      App.SellerView.bindEvents(viewport, handlers);
    } else if (activeTab === "admin") {
      viewport.innerHTML = App.AdminView.render(state);
      App.AdminView.bindEvents(viewport, handlers);
    } else {
      viewport.innerHTML = App.DemoLabView.render(state);
      App.DemoLabView.bindEvents(viewport, handlers);
    }

    const drawer = document.getElementById("cartDrawerBackdrop");
    if (drawer && !drawer.classList.contains("hidden")) {
      renderCartDrawer(state);
    }
  }

  function refreshCountdownBadgesInPlace(state) {
    const clockEl = document.getElementById("mockClockLabel");
    if (clockEl) {
      clockEl.textContent = App.Utils.formatDateTime(new Date(state.mockNowMs).toISOString());
    }
    document.querySelectorAll("[data-deadline-iso]").forEach((el) => {
      const deadline = el.getAttribute("data-deadline-iso");
      const rem = App.Utils.formatRemainingTime(deadline, state.mockNowMs);
      el.classList.toggle("expired", rem.expired);
      const span = el.querySelector("span");
      if (span) span.textContent = rem.text;
    });
  }

  function init() {
    // Initialize Theme & Brand Logo
    const initialTheme = App.Store.getTheme();
    App.Store.setTheme(initialTheme);
    updateThemeUi(initialTheme);

    try {
      const savedLogo = localStorage.getItem("goc_sach_se_chia_logo");
      if (savedLogo === "assets/logo-h-book.jpg" || savedLogo === "assets/logo-h-book-alt.jpg") {
        setBrandLogo(savedLogo);
      }
    } catch (e) {}

    // Sync config labels into footer
    const ftHours = document.getElementById("footerTimeoutHours");
    const ftRate = document.getElementById("footerCommissionRate");
    if (ftHours) ftHours.textContent = String(App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS);
    if (ftRate) ftRate.textContent = String(App.HUB_CONFIG.TRANSACTION_COMMISSION_RATE * 100);

    // Top navigation events
    document.querySelectorAll(".role-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-tab");
        render();
      });
    });

    const homeBtn = document.getElementById("brandHomeBtn");
    if (homeBtn) {
      homeBtn.addEventListener("click", () => {
        activeTab = "buyer";
        App.BuyerView.setSubtab("catalog");
        render();
      });
    }

    const themeBtn = document.getElementById("btnToggleTheme");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const next = App.Store.getTheme() === "dark" ? "light" : "dark";
        App.Store.setTheme(next);
        updateThemeUi(next);
      });
    }

    document.getElementById("btnOpenCart").addEventListener("click", openCartDrawer);
    document.getElementById("btnCloseCartDrawer").addEventListener("click", closeCartDrawer);
    document.getElementById("cartDrawerBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "cartDrawerBackdrop") closeCartDrawer();
    });

    document.getElementById("btnCloseModal").addEventListener("click", closeModal);
    document.getElementById("modalBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "modalBackdrop") closeModal();
    });

    // Mock Clock & Quick Controls
    document.querySelectorAll("[data-advance-hours]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const h = Number(btn.getAttribute("data-advance-hours"));
        const completed = App.Store.advanceClockHours(h);
        if (completed.length > 0) {
          toast(`Đã tua +${h} giờ! Hệ thống tự động hoàn tất ${completed.length} đơn quá hạn 48h: ${completed.join(", ")}`, "success");
        } else {
          toast(`Đã tua đồng hồ mô phỏng thêm +${h} giờ.`, "info");
        }
      });
    });

    document.getElementById("btnRunAutoComplete").addEventListener("click", () => {
      const completed = App.Store.triggerAutoCompletionScan();
      if (completed.length > 0) {
        toast(`Auto-Complete: Đã hoàn tất ${completed.length} đơn (${completed.join(", ")}) → Escrow giải ngân & Payout mô phỏng.`, "success");
      } else {
        toast("Không có đơn nào đủ điều kiện tự động hoàn tất lúc này (hãy thử tua +48 giờ).", "info");
      }
    });

    document.getElementById("btnResetDemo").addEventListener("click", () => {
      App.Store.resetAllData();
      toast("Đã khôi phục toàn bộ dữ liệu test mẫu PRD v1.2.", "info");
    });

    // Subscribe to store updates
    App.Store.subscribe(() => render());

    // Initial render
    render();

    // Gentle 1-second mock clock tick so 48h countdown timers tick visibly during presentation
    setInterval(() => {
      const s = App.Store.getState();
      s.mockNowMs += 1000;
      const autoDone = App.StateMachine.runAutoCompletion(s);
      if (autoDone.length > 0) {
        App.Store.notify();
        toast(`Hết hạn 48h! Hệ thống tự động hoàn tất: ${autoDone.join(", ")}`, "success");
      } else {
        refreshCountdownBadgesInPlace(s);
      }
    }, 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})(window.HubApp);
