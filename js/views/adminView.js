/* ==========================================================================
   Admin Console View (PRD v1.2: HUB-044, HUB-045, HUB-046, HUB-047, HUB-048)
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  const viewState = {
    subtab: "moderation", // "moderation" | "disputes" | "overdue" | "ledger"
  };

  function renderModerationTab(state) {
    const { escapeHtml, formatVnd, formatDateTime } = App.Utils;
    const pending = state.listings.filter((l) => l.status === "pending_review");
    const reviewed = state.listings.filter((l) => l.status !== "pending_review");

    return `
      <div class="card mb-2">
        <div class="card-header">
          <h3 class="card-title">Hàng đợi kiểm duyệt Listing (HUB-044 • BR-02)</h3>
          <span class="badge badge-warn">${pending.length} chờ duyệt</span>
        </div>
        ${
          pending.length === 0
            ? `<p class="text-sm muted">Không còn sách nào đang chờ kiểm duyệt.</p>`
            : pending
                .map((item) => {
                  const seller = state.sellers.find((s) => s.id === item.sellerId);
                  return `
                    <div class="order-line-item" style="align-items:flex-start;">
                      <div style="flex:1;">
                        <div class="flex flex-wrap items-center gap-1">
                          <strong>${escapeHtml(item.title)}</strong>
                          <span class="badge badge-warn">pending_review</span>
                        </div>
                        <div class="text-xs muted mt-1">
                          <code>${item.id}</code> • Seller: <strong>${escapeHtml(seller ? seller.name : item.sellerId)}</strong> •
                          Tác giả: ${escapeHtml(item.author)} • Thể loại: ${escapeHtml(item.category)} •
                          Giá: <strong>${formatVnd(item.price)}</strong> • Tồn kho: ${item.stock}
                        </div>
                        <div class="text-xs mt-1">${escapeHtml(item.description)}</div>
                        <div class="text-xs muted mt-1">Gửi duyệt lúc: ${formatDateTime(item.moderation && item.moderation.submittedAt)}</div>
                      </div>
                      <div class="flex flex-wrap gap-1">
                        <button type="button" class="btn btn-sm btn-success" data-admin-approve-listing="${item.id}">Duyệt (active)</button>
                        <button type="button" class="btn btn-sm btn-danger-soft" data-admin-reject-listing="${item.id}">Từ chối</button>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Lịch sử đã kiểm duyệt (${reviewed.length})</h3>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th>Quyết định</th>
                <th>Người duyệt</th>
                <th>Thời điểm</th>
                <th>Lý do (nếu từ chối)</th>
              </tr>
            </thead>
            <tbody>
              ${reviewed
                .map((item) => {
                  const seller = state.sellers.find((s) => s.id === item.sellerId);
                  const mod = item.moderation || {};
                  return `
                    <tr>
                      <td><strong>${escapeHtml(item.title)}</strong><div class="text-xs muted"><code>${item.id}</code></div></td>
                      <td>${escapeHtml(seller ? seller.name : item.sellerId)}</td>
                      <td>
                        <span class="badge ${item.status === "active" ? "badge-success" : "badge-danger"}">
                          ${escapeHtml(mod.decision || item.status)}
                        </span>
                      </td>
                      <td><code>${escapeHtml(mod.reviewedBy || "--")}</code></td>
                      <td>${formatDateTime(mod.reviewedAt)}</td>
                      <td class="text-xs">${escapeHtml(mod.rejectionReason || "—")}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderDisputesTab(state) {
    const { escapeHtml, formatVnd, formatDateTime } = App.Utils;
    const activeDisputes = state.disputes.filter((d) => d.status === "open" || d.status === "under_review");
    const resolvedDisputes = state.disputes.filter((d) => d.status === "resolved_buyer" || d.status === "resolved_seller");

    return `
      <div class="alert alert-info">
        <div>
          <strong>BR-04 Nguyên tắc xử lý tranh chấp:</strong> Chỉ Admin có quyền đưa ra phán quyết cuối cùng theo 2 phương án
          (<strong>Hoàn tiền Buyer</strong> hoặc <strong>Hoàn tất Order</strong>). Không cho phép xử lý tranh chấp 2 lần.
        </div>
      </div>

      <div class="card mb-2">
        <div class="card-header">
          <h3 class="card-title">Tranh chấp đang chờ Admin xử lý (${activeDisputes.length})</h3>
          <span class="text-xs muted">HUB-045 & HUB-046</span>
        </div>
        ${
          activeDisputes.length === 0
            ? `<p class="text-sm muted">Không còn hồ sơ tranh chấp nào đang mở.</p>`
            : activeDisputes
                .map((d) => {
                  const order = state.orders.find((o) => o.id === d.orderId);
                  const seller = order ? state.sellers.find((s) => s.id === order.sellerId) : null;
                  const escrow = state.escrows.find((e) => e.orderId === d.orderId);
                  return `
                    <div class="seller-group-box">
                      <div class="seller-group-head">
                        <div>
                          <strong>${d.id}</strong> • Order: <strong>${d.orderId}</strong> • Seller: ${escapeHtml(seller ? seller.name : "")}
                          <div class="text-xs muted">Mở lúc: ${formatDateTime(d.createdAt)} • Escrow: <code>${escrow ? escrow.status : "--"}</code> (${order ? formatVnd(order.total) : "--"})</div>
                        </div>
                        <span class="badge ${d.status === "open" ? "badge-danger" : "badge-warn"}">${d.status}</span>
                      </div>
                      <div class="seller-group-body">
                        <p class="text-sm" style="margin:0 0 6px;"><strong>Lý do:</strong> ${escapeHtml(d.reason)}</p>
                        <p class="text-sm muted" style="margin:0 0 8px;">${escapeHtml(d.description)}</p>
                        <div class="text-xs muted mb-2">
                          <strong>Bằng chứng mô phỏng:</strong> ${d.evidence.map((ev) => `<code>${escapeHtml(ev)}</code>`).join(", ")}
                        </div>
                        <div class="flex flex-wrap gap-2">
                          ${
                            d.status === "open"
                              ? `<button type="button" class="btn btn-sm btn-outline" data-admin-under-review="${d.id}">Nhận xử lý (under_review)</button>`
                              : ""
                          }
                          <button type="button" class="btn btn-sm btn-danger" data-admin-resolve-dispute="${d.id}" data-decision="refund_buyer">
                            Phương án A: Hoàn tiền Buyer
                          </button>
                          <button type="button" class="btn btn-sm btn-success" data-admin-resolve-dispute="${d.id}" data-decision="complete_order">
                            Phương án B: Hoàn tất cho Seller
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Lịch sử xử lý tranh chấp (HUB-048)</h3>
          <span class="text-xs muted">Đã lưu Admin ID, phương án, lý do, thời điểm & khóa xử lý trùng</span>
        </div>
        ${
          resolvedDisputes.length === 0
            ? `<p class="text-sm muted">Chưa có tranh chấp nào được giải quyết.</p>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Dispute / Order</th>
                      <th>Trạng thái</th>
                      <th>Phương án & Lý do</th>
                      <th>Admin & Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${resolvedDisputes
                      .map((d) => {
                        const res = d.resolution || {};
                        return `
                          <tr>
                            <td><strong>${d.id}</strong><div class="text-xs muted">Order: ${d.orderId}</div></td>
                            <td>
                              <span class="badge ${d.status === "resolved_buyer" ? "badge-danger" : "badge-success"}">${d.status}</span>
                            </td>
                            <td class="text-xs">
                              <div><strong><code>${escapeHtml(res.decision)}</code></strong></div>
                              <div>${escapeHtml(res.reason)}</div>
                            </td>
                            <td class="text-xs">
                              <code>${escapeHtml(res.adminId)}</code>
                              <div>${formatDateTime(res.resolvedAt)}</div>
                            </td>
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

  function renderOverdueTab(state) {
    const { escapeHtml, formatVnd, formatDateTime, formatRemainingTime } = App.Utils;
    const waitingOrders = state.orders.filter((o) => o.status === "waiting_confirmation");
    const overdueOrders = waitingOrders.filter((o) => state.mockNowMs >= Date.parse(o.confirmationDeadline));
    const autoCompletedOrders = state.orders.filter((o) => o.completionSource === "system_auto_completion");

    return `
      <div class="card mb-2">
        <div class="card-header">
          <div>
            <h3 class="card-title">Đơn chờ xác nhận & Quá hạn ${App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS} giờ (HUB-047)</h3>
            <p class="text-xs muted" style="margin:2px 0 0;">Đơn quá hạn sẽ tự động hoàn tất trừ khi có Dispute mở hoặc bị Admin khóa (<code>adminLocked</code>).</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="adminScanAutoCompleteBtn">
            Quét Auto-Complete (${overdueOrders.filter((o) => !o.adminLocked).length} đủ ĐK)
          </button>
        </div>

        ${
          waitingOrders.length === 0
            ? `<p class="text-sm muted">Không còn đơn nào đang ở trạng thái waiting_confirmation.</p>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Order / Seller</th>
                      <th>Giá trị</th>
                      <th>Bắt đầu chờ xác nhận</th>
                      <th>Hạn 48h & Trạng thái</th>
                      <th>Khóa xử lý đặc biệt (TC-T06)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${waitingOrders
                      .map((o) => {
                        const seller = state.sellers.find((s) => s.id === o.sellerId);
                        const rem = formatRemainingTime(o.confirmationDeadline, state.mockNowMs);
                        return `
                          <tr>
                            <td><strong>${o.id}</strong><div class="text-xs muted">${escapeHtml(seller ? seller.name : o.sellerId)}</div></td>
                            <td class="fw-bold">${formatVnd(o.total)}</td>
                            <td class="text-xs">${formatDateTime(o.waitingConfirmationAt)}</td>
                            <td>
                              <span class="countdown-box ${rem.expired ? "expired" : ""}" data-deadline-iso="${o.confirmationDeadline}">
                                <span>${rem.text}</span>
                              </span>
                              <div class="text-xs muted mt-1">Deadline: ${formatDateTime(o.confirmationDeadline)}</div>
                            </td>
                            <td>
                              <button type="button" class="btn btn-xs ${o.adminLocked ? "btn-warning" : "btn-outline"}" data-admin-toggle-lock="${o.id}">
                                ${o.adminLocked ? "Mở khóa (Đang khóa)" : "Khóa auto-complete"}
                              </button>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Các đơn đã tự động hoàn tất bởi hệ thống (${autoCompletedOrders.length})</h3>
          <span class="badge badge-teal">completionSource = system_auto_completion</span>
        </div>
        ${
          autoCompletedOrders.length === 0
            ? `<p class="text-sm muted">Chưa có đơn tự hoàn tất.</p>`
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Seller</th>
                      <th>Tổng đơn</th>
                      <th>Escrow</th>
                      <th>Payout</th>
                      <th>Hoàn tất lúc</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${autoCompletedOrders
                      .map((o) => {
                        const seller = state.sellers.find((s) => s.id === o.sellerId);
                        const esc = state.escrows.find((e) => e.orderId === o.id);
                        const pay = state.payouts.find((p) => p.orderId === o.id);
                        return `
                          <tr>
                            <td><strong>${o.id}</strong></td>
                            <td>${escapeHtml(seller ? seller.name : o.sellerId)}</td>
                            <td>${formatVnd(o.total)}</td>
                            <td><span class="badge badge-success">${esc ? esc.status : "--"}</span></td>
                            <td><span class="badge badge-success">${pay ? `${pay.status} (${formatVnd(pay.amount)})` : "--"}</span></td>
                            <td class="text-xs">${formatDateTime(o.completedAt)}</td>
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

  function renderLedgerTab(state) {
    const { escapeHtml, formatVnd, formatDateTime } = App.Utils;
    return `
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Checkout Sessions (${state.checkoutSessions.length})</h3>
            <span class="badge badge-sim">SIMULATED</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Orders</th>
                  <th>Subtotal</th>
                  <th>Ship</th>
                  <th>Giảm giá</th>
                  <th>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                ${state.checkoutSessions
                  .map(
                    (cs) => `
                    <tr>
                      <td><code>${cs.id}</code><div class="text-xs muted">${formatDateTime(cs.createdAt)}</div></td>
                      <td class="text-xs">${cs.orderIds.join(", ")}</td>
                      <td>${formatVnd(cs.subtotal)}</td>
                      <td>${formatVnd(cs.shippingTotal)}</td>
                      <td class="text-teal">-${formatVnd(cs.discountTotal)}</td>
                      <td class="fw-bold text-blue">${formatVnd(cs.grandTotal)}</td>
                    </tr>
                  `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Nhật ký Audit hệ thống (${state.auditLogs.length})</h3>
          </div>
          <div style="max-height:380px;overflow-y:auto;">
            ${state.auditLogs
              .map(
                (log) => `
                <div class="order-line-item" style="align-items:flex-start;">
                  <div>
                    <div class="text-xs">
                      <span class="badge badge-info">${escapeHtml(log.action)}</span>
                      <code style="margin-left:4px;">${escapeHtml(log.actor)}</code>
                      <span class="muted" style="margin-left:4px;">${formatDateTime(log.time)}</span>
                    </div>
                    <div class="text-sm mt-1">${escapeHtml(log.detail)}</div>
                  </div>
                </div>
              `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  function render(state) {
    const { formatVnd } = App.Utils;
    const pendingCount = state.listings.filter((l) => l.status === "pending_review").length;
    const openDisputesCount = state.disputes.filter((d) => d.status === "open" || d.status === "under_review").length;
    const overdueCount = state.orders.filter(
      (o) => o.status === "waiting_confirmation" && state.mockNowMs >= Date.parse(o.confirmationDeadline)
    ).length;

    const simulatedGmv = state.orders
      .filter((o) => o.status !== "refunded" && o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);
    // Projection example clearly marked as projection (Acceptance Criteria: Data Integrity)
    const monthlyProjectionGmv = simulatedGmv * 12;

    return `
      <section>
        <div class="page-header">
          <div>
            <h1 class="page-title">Admin Console – Kiểm duyệt, 48h Monitor & Tranh chấp</h1>
            <p class="page-subtitle">Quản trị toàn bộ luồng BR-02, BR-03, BR-04 với dữ liệu mô phỏng và dự phóng tách biệt rõ ràng.</p>
          </div>
        </div>

        <div class="grid-4 mb-3">
          <div class="kpi-card kpi-yellow">
            <div class="kpi-label"><span>Listing chờ duyệt</span><span class="badge badge-warn">HUB-044</span></div>
            <div class="kpi-value">${pendingCount}</div>
            <div class="kpi-sub">Chỉ Admin có quyền duyệt sang <code>active</code></div>
          </div>
          <div class="kpi-card kpi-pink">
            <div class="kpi-label"><span>Tranh chấp đang mở</span><span class="badge badge-danger">BR-04</span></div>
            <div class="kpi-value">${openDisputesCount}</div>
            <div class="kpi-sub">Escrow đóng băng <code>simulated_frozen</code></div>
          </div>
          <div class="kpi-card kpi-teal">
            <div class="kpi-label"><span>Đơn quá hạn 48h</span><span class="badge badge-teal">HUB-047</span></div>
            <div class="kpi-value">${overdueCount}</div>
            <div class="kpi-sub">Đang chờ quét <code>system_auto_completion</code></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label"><span>GMV Mô phỏng / Dự phóng</span><span class="badge badge-sim">PROJECTION</span></div>
            <div class="kpi-value">${formatVnd(simulatedGmv)}</div>
            <div class="kpi-sub">Dự phóng tháng (<code>projection</code>): ~${formatVnd(monthlyProjectionGmv)}</div>
          </div>
        </div>

        <div class="subtabs mb-2">
          <button type="button" class="subtab-btn ${viewState.subtab === "moderation" ? "active" : ""}" data-admin-subtab="moderation">Kiểm duyệt Listing (${pendingCount})</button>
          <button type="button" class="subtab-btn ${viewState.subtab === "disputes" ? "active" : ""}" data-admin-subtab="disputes">Xử lý Tranh chấp (${openDisputesCount})</button>
          <button type="button" class="subtab-btn ${viewState.subtab === "overdue" ? "active" : ""}" data-admin-subtab="overdue">Đơn chờ & Quá hạn 48h (${overdueCount})</button>
          <button type="button" class="subtab-btn ${viewState.subtab === "ledger" ? "active" : ""}" data-admin-subtab="ledger">Sessions & Audit Log</button>
        </div>

        ${
          viewState.subtab === "moderation"
            ? renderModerationTab(state)
            : viewState.subtab === "disputes"
            ? renderDisputesTab(state)
            : viewState.subtab === "overdue"
            ? renderOverdueTab(state)
            : renderLedgerTab(state)
        }
      </section>
    `;
  }

  function bindEvents(root, handlers) {
    root.querySelectorAll("[data-admin-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        viewState.subtab = btn.getAttribute("data-admin-subtab");
        handlers.rerender();
      });
    });

    root.querySelectorAll("[data-admin-approve-listing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.adminModerateListing(
          s,
          btn.getAttribute("data-admin-approve-listing"),
          "approved",
          "admin-01",
          "",
          "admin"
        );
        if (res.ok) {
          App.Store.notify();
          handlers.toast(`Đã duyệt "${res.listing.title}" → xuất hiện công khai trên Sàn sách!`, "success");
        } else {
          handlers.toast(res.error, "error");
        }
      });
    });

    root.querySelectorAll("[data-admin-reject-listing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handlers.openRejectListingModal(btn.getAttribute("data-admin-reject-listing"));
      });
    });

    root.querySelectorAll("[data-admin-under-review]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.adminSetDisputeUnderReview(s, btn.getAttribute("data-admin-under-review"), "admin-01");
        if (res.ok) {
          App.Store.notify();
          handlers.toast(`Tranh chấp ${res.dispute.id} đã chuyển sang under_review.`, "info");
        } else {
          handlers.toast(res.error, "error");
        }
      });
    });

    root.querySelectorAll("[data-admin-resolve-dispute]").forEach((btn) => {
      btn.addEventListener("click", () => {
        handlers.openResolveDisputeModal(
          btn.getAttribute("data-admin-resolve-dispute"),
          btn.getAttribute("data-decision")
        );
      });
    });

    root.querySelectorAll("[data-admin-toggle-lock]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = App.Store.getState();
        const res = App.StateMachine.toggleAdminOrderLock(s, btn.getAttribute("data-admin-toggle-lock"), "admin-01");
        if (res.ok) {
          App.Store.notify();
          handlers.toast(
            `${res.order.id}: ${res.order.adminLocked ? "Đã khóa (ngăn auto-complete)" : "Đã mở khóa"}.`,
            "info"
          );
        }
      });
    });

    const scanBtn = root.querySelector("#adminScanAutoCompleteBtn");
    if (scanBtn) {
      scanBtn.addEventListener("click", () => {
        const completed = App.Store.triggerAutoCompletionScan();
        if (completed.length > 0) {
          handlers.toast(`Đã tự động hoàn tất ${completed.length} đơn quá 48h: ${completed.join(", ")}`, "success");
        } else {
          handlers.toast("Không có đơn nào đủ cả 5 điều kiện tự động hoàn tất tại thời điểm hiện tại.", "info");
        }
      });
    }
  }

  App.AdminView = {
    render,
    bindEvents,
  };
})(window.HubApp);
