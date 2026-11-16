/* ==========================================================================
   Seller Center View (PRD v1.2: HUB-039, HUB-041, HUB-042, HUB-043, BR-02, BR-04)
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  const viewState = {
    subtab: "listings", // "listings" | "orders" | "payouts"
  };

  function renderListingsTab(state, seller) {
    const { escapeHtml, formatVnd, formatDateTime } = App.Utils;
    const sellerListings = state.listings.filter((l) => l.sellerId === seller.id);

    return `
      <div class="grid-2" style="grid-template-columns:minmax(290px, 0.9fr) minmax(0, 1.5fr);align-items:start;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Đăng bán sách cũ mới</h3>
            <span class="badge badge-warn">Mặc định: pending_review</span>
          </div>
          <form id="sellerCreateListingForm">
            <div class="form-group">
              <label class="form-label">Tên sách *</label>
              <input class="input" name="title" required placeholder="VD: Bố Già (Bản dịch cũ 1999)" />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Tác giả</label>
                <input class="input" name="author" placeholder="Mario Puzo" />
              </div>
              <div class="form-group">
                <label class="form-label">Thể loại</label>
                <select class="select" name="category">
                  <option value="Văn học">Văn học</option>
                  <option value="Kỹ năng sống">Kỹ năng sống</option>
                  <option value="Tâm lý học">Tâm lý học</option>
                  <option value="Công nghệ">Công nghệ</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Thiếu nhi">Thiếu nhi</option>
                  <option value="Kinh tế">Kinh tế</option>
                </select>
              </div>
            </div>
            <div class="grid-3">
              <div class="form-group">
                <label class="form-label">Giá bán (đ) *</label>
                <input class="input" type="number" name="price" min="1000" step="1000" required value="95000" />
              </div>
              <div class="form-group">
                <label class="form-label">Tồn kho *</label>
                <input class="input" type="number" name="stock" min="1" required value="1" />
              </div>
              <div class="form-group">
                <label class="form-label">Tình trạng</label>
                <select class="select" name="condition">
                  <option value="Như mới (95%)">Như mới (95%)</option>
                  <option value="Tốt (90%)">Tốt (90%)</option>
                  <option value="Khá (82%)">Khá (82%)</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Mô tả tình trạng sách</label>
              <textarea class="textarea" name="description" rows="2" placeholder="Tình trạng bìa, gáy, trang in..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Gửi kiểm duyệt Listing (pending_review)</button>
          </form>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Danh sách sách của ${escapeHtml(seller.name)} (${sellerListings.length})</h3>
            <span class="text-xs muted">HUB-041 & HUB-042 • Kiểm duyệt BR-02</span>
          </div>
          ${sellerListings
            .map((item) => {
              const mod = item.moderation || {};
              const statusBadge =
                item.status === "active"
                  ? `<span class="badge badge-success">active (Đang hiển thị công khai)</span>`
                  : item.status === "pending_review"
                  ? `<span class="badge badge-warn">pending_review (Chờ Admin duyệt)</span>`
                  : `<span class="badge badge-danger">rejected (Bị từ chối)</span>`;

              return `
                <div class="order-line-item" style="align-items:flex-start;">
                  <div style="flex:1;">
                    <div class="flex flex-wrap items-center gap-1">
                      <strong>${escapeHtml(item.title)}</strong>
                      ${statusBadge}
                    </div>
                    <div class="text-xs muted mt-1">
                      <code>${item.id}</code> • ${escapeHtml(item.category)} • ${escapeHtml(item.condition)} •
                      Giá: <strong>${formatVnd(item.price)}</strong> • Tồn kho: <strong>${item.stock}</strong>
                    </div>
                    <div class="text-xs muted">
                      Gửi duyệt: ${formatDateTime(mod.submittedAt)}
                      ${mod.reviewedAt ? ` • Xử lý bởi <code>${escapeHtml(mod.reviewedBy)}</code> lúc ${formatDateTime(mod.reviewedAt)}` : ""}
                    </div>
                    ${
                      item.status === "rejected" && mod.rejectionReason
                        ? `<div class="alert alert-danger mt-1" style="margin-bottom:0;padding:7px 10px;">
                            <div><strong>Lý do từ chối (HUB-042):</strong> ${escapeHtml(mod.rejectionReason)}</div>
                          </div>`
                        : ""
                    }
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <button type="button" class="btn btn-xs btn-outline" data-seller-edit-listing="${item.id}">Sửa</button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderOrdersTab(state, seller) {
    const { escapeHtml, formatVnd, formatDateTime, formatRemainingTime } = App.Utils;
    const sellerOrders = state.orders.filter((o) => o.sellerId === seller.id);

    if (sellerOrders.length === 0) {
      return `<div class="card text-sm muted">Seller này chưa có đơn hàng nào.</div>`;
    }

    return sellerOrders
      .map((order) => {
        const meta = App.ORDER_STATUS_META[order.status] || { label: order.status, badge: "badge-info" };
        const items = state.orderItems.filter((oi) => oi.orderId === order.id);
        const shipment = state.shipments.find((s) => s.orderId === order.id);
        const escrow = state.escrows.find((e) => e.orderId === order.id);
        const payout = state.payouts.find((p) => p.orderId === order.id);
        const dispute = state.disputes.find((d) => d.orderId === order.id);
        const rem = order.status === "waiting_confirmation" ? formatRemainingTime(order.confirmationDeadline, state.mockNowMs) : null;

        return `
          <article class="card mb-2">
            <div class="card-header">
              <div>
                <div class="flex flex-wrap items-center gap-1">
                  <strong>${order.id}</strong>
                  <span class="badge ${meta.badge}">${escapeHtml(meta.label)}</span>
                  ${
                    order.completionSource === "system_auto_completion"
                      ? `<span class="badge badge-teal">HUB-043: Tự động hoàn tất sau 48h</span>`
                      : ""
                  }
                  ${order.adminLocked ? `<span class="badge badge-danger">Admin đang khóa</span>` : ""}
                </div>
                <div class="text-xs muted mt-1">
                  Session: <code>${order.checkoutSessionId}</code> • Vận chuyển: <strong>${escapeHtml(shipment ? shipment.carrier : "")}</strong> (<code>${shipment ? shipment.trackingCode : ""}</code> • Ship riêng ${formatVnd(order.shippingFee)})
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-1">
                ${
                  meta.next
                    ? `<button type="button" class="btn btn-sm btn-primary" data-advance-order="${order.id}">${escapeHtml(meta.nextLabel)}</button>`
                    : ""
                }
                ${
                  ["pending_seller", "confirmed", "ready_for_pickup", "picked_up"].includes(order.status)
                    ? `<button type="button" class="btn btn-sm btn-outline" data-fast-deliver="${order.id}" title="Chuyển nhanh sang delivered → waiting_confirmation (48h)">Giao xong (Sim)</button>`
                    : ""
                }
              </div>
            </div>

            <div class="grid-2">
              <div>
                ${items
                  .map(
                    (it) => `
                    <div class="order-line-item">
                      <span class="text-sm"><strong>${escapeHtml(it.snapshotTitle)}</strong> × ${it.quantity}</span>
                      <strong>${formatVnd(it.lineSubtotal)}</strong>
                    </div>
                  `
                  )
                  .join("")}
              </div>
              <div class="card" style="background:var(--bg-surface-alt);padding:10px 12px;">
                <div class="summary-row"><span>Giá trị sách (Subtotal):</span><strong>${formatVnd(order.subtotal)}</strong></div>
                <div class="summary-row"><span>Escrow:</span><span class="badge ${escrow && App.ESCROW_STATUS_META[escrow.status] ? App.ESCROW_STATUS_META[escrow.status].badge : "badge-info"}">${escrow ? escrow.status : "--"}</span></div>
                <div class="summary-row"><span>Payout mô phỏng:</span><strong>${payout ? `${formatVnd(payout.amount)} (${payout.status})` : "Chưa giải ngân"}</strong></div>
                ${
                  rem
                    ? `<div class="text-xs mt-1 text-teal"><strong>Hạn xác nhận 48h:</strong> ${rem.text} (đến ${formatDateTime(order.confirmationDeadline)})</div>`
                    : ""
                }
                ${
                  order.completionSource
                    ? `<div class="text-xs mt-1 text-teal"><strong>completionSource:</strong> <code>${order.completionSource}</code></div>`
                    : ""
                }
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPayoutsTab(state, seller) {
    const { escapeHtml, formatVnd, formatDateTime } = App.Utils;
    const payouts = state.payouts.filter((p) => p.sellerId === seller.id);

    return `
      <div class="alert alert-info">
        <div>
          <strong>Lưu ý dữ liệu mô phỏng (Data Integrity):</strong>
          Tất cả khoản Payout đều mang <code>dataType: "simulated"</code> và tính với hoa hồng <strong>${App.HUB_CONFIG.TRANSACTION_COMMISSION_RATE * 100}%</strong>. Không phải doanh thu thật.
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Lịch sử Payout mô phỏng (HUB-039)</h3>
          <span class="badge badge-sim">SIMULATED PAYOUTS</span>
        </div>
        ${
          payouts.length === 0
            ? `<p class="text-sm muted">Chưa có Payout mô phỏng nào cho Seller này.</p>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Payout ID</th>
                      <th>Order ID</th>
                      <th>Số tiền (0% phí)</th>
                      <th>Trạng thái</th>
                      <th>Nguồn hoàn tất (source)</th>
                      <th>Thời điểm trả</th>
                      <th>Loại dữ liệu</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${payouts
                      .map((p) => {
                        const meta = App.PAYOUT_STATUS_META[p.status] || { label: p.status, badge: "badge-info" };
                        return `
                          <tr>
                            <td><code>${p.id}</code></td>
                            <td><strong>${p.orderId}</strong></td>
                            <td class="fw-bold text-blue">${formatVnd(p.amount)}</td>
                            <td><span class="badge ${meta.badge}">${escapeHtml(meta.label)}</span></td>
                            <td><code>${escapeHtml(p.source)}</code></td>
                            <td>${formatDateTime(p.paidAt)}</td>
                            <td><span class="badge badge-sim">${p.dataType}</span></td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    `;
  }

  function render(state) {
    const { escapeHtml, formatVnd } = App.Utils;
    const seller = state.sellers.find((s) => s.id === state.activeSellerId) || state.sellers[0];

    const sellerListings = state.listings.filter((l) => l.sellerId === seller.id);
    const sellerOrders = state.orders.filter((o) => o.sellerId === seller.id);
    const sellerPayouts = state.payouts.filter((p) => p.sellerId === seller.id);

    const autoCompletedCount = sellerOrders.filter((o) => o.completionSource === "system_auto_completion").length;
    const paidSum = sellerPayouts
      .filter((p) => p.status === "simulated_paid")
      .reduce((sum, p) => sum + p.amount, 0);

    return `
      <section>
        <div class="page-header">
          <div>
            <h1 class="page-title">Seller Center – Quản lý gian hàng</h1>
            <p class="page-subtitle">Đăng bán sách mới (<code>pending_review</code>), theo dõi lý do từ chối, xử lý giao vận & kiểm tra đơn tự hoàn tất sau 48h.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <label class="text-sm fw-bold">Gian hàng:</label>
            <select class="select" id="sellerSwitcherSelect" style="width:auto;min-width:240px;">
              ${state.sellers
                .map(
                  (s) =>
                    `<option value="${s.id}" ${s.id === seller.id ? "selected" : ""}>${escapeHtml(s.name)} (${escapeHtml(s.city)})</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="grid-4 mb-3">
          <div class="kpi-card">
            <div class="kpi-label"><span>Sách đang bán (active)</span><span class="badge badge-success">BR-02</span></div>
            <div class="kpi-value">${sellerListings.filter((l) => l.status === "active").length} / ${sellerListings.length}</div>
            <div class="kpi-sub">Chờ duyệt: ${sellerListings.filter((l) => l.status === "pending_review").length} • Từ chối: ${sellerListings.filter((l) => l.status === "rejected").length}</div>
          </div>
          <div class="kpi-card kpi-teal">
            <div class="kpi-label"><span>Đơn hàng của Seller</span><span>${escapeHtml(seller.carrier)}</span></div>
            <div class="kpi-value">${sellerOrders.length} đơn</div>
            <div class="kpi-sub">Phí ship mặc định: ${formatVnd(seller.shippingFee)} / Order</div>
          </div>
          <div class="kpi-card kpi-yellow">
            <div class="kpi-label"><span>Đơn tự hoàn tất 48h</span><span class="badge badge-teal">HUB-043</span></div>
            <div class="kpi-value">${autoCompletedCount} đơn</div>
            <div class="kpi-sub">Nguồn: <code>system_auto_completion</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>Payout mô phỏng</span><span class="badge badge-sim">SIMULATED</span></div>
            <div class="kpi-value">${formatVnd(paidSum)}</div>
            <div class="kpi-sub">Hoa hồng 0% • Không phải doanh thu thật</div>
          </div>
        </div>

        <div class="subtabs mb-2">
          <button type="button" class="subtab-btn ${viewState.subtab === "listings" ? "active" : ""}" data-seller-subtab="listings">Quản lý sách & Kiểm duyệt (${sellerListings.length})</button>
          <button type="button" class="subtab-btn ${viewState.subtab === "orders" ? "active" : ""}" data-seller-subtab="orders">Đơn hàng & Giao vận (${sellerOrders.length})</button>
          <button type="button" class="subtab-btn ${viewState.subtab === "payouts" ? "active" : ""}" data-seller-subtab="payouts">Payout mô phỏng (${sellerPayouts.length})</button>
        </div>

        ${
          viewState.subtab === "listings"
            ? renderListingsTab(state, seller)
            : viewState.subtab === "orders"
            ? renderOrdersTab(state, seller)
            : renderPayoutsTab(state, seller)
        }
      </section>
    `;
  }

  function bindEvents(root, handlers) {
    const switcher = root.querySelector("#sellerSwitcherSelect");
    if (switcher) {
      switcher.addEventListener("change", (e) => {
        const s = App.Store.getState();
        s.activeSellerId = e.target.value;
        App.Store.notify();
      });
    }

    root.querySelectorAll("[data-seller-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewState.subtab = btn.getAttribute("data-seller-subtab");
        handlers.rerender();
      });
    });

    const createForm = root.querySelector("#sellerCreateListingForm");
    if (createForm) {
      createForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(createForm);
        const s = App.Store.getState();
        const res = App.StateMachine.sellerCreateListing(s, s.activeSellerId, {
          title: fd.get("title"),
          author: fd.get("author"),
          category: fd.get("category"),
          price: fd.get("price"),
          stock: fd.get("stock"),
          condition: fd.get("condition"),
          description: fd.get("description"),
        });
        if (res.ok) {
          App.Store.notify();
          handlers.toast(`Đã tạo "${res.listing.title}" ở trạng thái pending_review. Chờ Admin duyệt để hiển thị công khai!`, "success");
        } else {
          handlers.toast(res.error, "error");
        }
      });
    }

    root.querySelectorAll("[data-seller-edit-listing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handlers.openEditListingModal(btn.getAttribute("data-seller-edit-listing"));
      });
    });

    root.querySelectorAll("[data-advance-order]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.advanceOrderStatus(s, btn.getAttribute("data-advance-order"));
        if (res.ok) {
          App.Store.notify();
          handlers.toast(`Đơn ${res.order.id} đã chuyển sang trạng thái "${res.order.status}".`, "success");
        } else {
          handlers.toast(res.error, "error");
        }
      });
    });

    root.querySelectorAll("[data-fast-deliver]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.fastForwardToDelivered(s, btn.getAttribute("data-fast-deliver"));
        if (res.ok) {
          App.Store.notify();
          handlers.toast(`Đơn ${res.order.id} đã giao → waiting_confirmation (Hạn 48h).`, "success");
        } else {
          handlers.toast(res.error, "error");
        }
      });
    });
  }

  App.SellerView = {
    render,
    bindEvents,
  };
})(window.HubApp);
