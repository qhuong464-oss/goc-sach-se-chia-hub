/* ==========================================================================
   Presentation & QA Test Lab View (PRD v1.2 Config, Brand, Schema & 33 Test Cases)
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  const viewState = {
    testResults: null,
    schemaEntity: "checkoutSessions",
  };

  function render(state) {
    const { escapeHtml } = App.Utils;

    if (!viewState.testResults) {
      viewState.testResults = App.Store.runPrdTestSuite();
    }

    const results = viewState.testResults;
    const passedCount = results.filter((r) => r.passed).length;

    const schemaMap = {
      hubConfig: App.HUB_CONFIG,
      checkoutSessions: state.checkoutSessions,
      orders: state.orders,
      orderItems: state.orderItems,
      escrows: state.escrows,
      payouts: state.payouts,
      disputes: state.disputes,
      moderations: state.listings.map((l) => l.moderation),
    };

    const selectedJson = JSON.stringify(schemaMap[viewState.schemaEntity] || [], null, 2);

    return `
      <section>
        <div class="page-header">
          <div>
            <h1 class="page-title">Demo & Test Lab – Thuyết trình & Kiểm thử PRD v1.2</h1>
            <p class="page-subtitle">Tổng hợp cấu hình chuẩn, bảng màu thương hiệu BR-05, bộ 33 Test Case thực thi trực tiếp và Schema Inspector.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" id="btnRunAllPrdTests">Chạy lại toàn bộ ${results.length} Test Cases</button>
          </div>
        </div>

        <!-- Section 1: Owner Confirmations & Brand Identity -->
        <div class="grid-2 mb-3">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Owner Confirmations & HUB_CONFIG</h3>
              <span class="badge badge-success">CONFIRMED</span>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Quyết định chính thức</th>
                    <th>Giá trị trong <code>HUB_CONFIG</code></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>CONF-01</strong></td>
                    <td>Thời hạn xác nhận nhận hàng</td>
                    <td><code>ORDER_CONFIRMATION_TIMEOUT_HOURS = ${App.HUB_CONFIG.ORDER_CONFIRMATION_TIMEOUT_HOURS}</code> giờ</td>
                  </tr>
                  <tr>
                    <td><strong>CONF-02</strong></td>
                    <td>Phí vận chuyển</td>
                    <td><code>SHIPPING_FEE_MODE = "${App.HUB_CONFIG.SHIPPING_FEE_MODE}"</code></td>
                  </tr>
                  <tr>
                    <td><strong>CONF-03</strong></td>
                    <td>Phân bổ mã giảm giá</td>
                    <td><code>DISCOUNT_ALLOCATION_MODE = "${App.HUB_CONFIG.DISCOUNT_ALLOCATION_MODE}"</code></td>
                  </tr>
                  <tr>
                    <td><strong>3.1 / 4.8</strong></td>
                    <td>Hoa hồng & Chế độ dữ liệu</td>
                    <td><code>RATE = ${App.HUB_CONFIG.TRANSACTION_COMMISSION_RATE}%</code> • <code>DATA_MODE = "${App.HUB_CONFIG.DATA_MODE}"</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Bảng màu thương hiệu chuẩn (BR-05)</h3>
              <span class="badge badge-info">Light & Dark Theme</span>
            </div>
            <div class="swatch-grid">
              ${App.BRAND_TOKENS.map(
                (t) => `
                  <div class="swatch-card">
                    <div class="swatch-color" style="background:${t.hex};border-bottom:1px solid var(--border-color);"></div>
                    <div class="swatch-info">
                      <div class="fw-bold">${escapeHtml(t.token)}</div>
                      <code>${t.hex}</code>
                      <div class="text-xs muted">${escapeHtml(t.usage)}</div>
                    </div>
                  </div>
                `
              ).join("")}
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header">
            <h3 class="card-title">Bộ Logo AI Chữ H & Sách Cũ (Brand Emblem)</h3>
            <span class="badge badge-teal">assets/logo-h-book*.jpg</span>
          </div>
          <div class="logo-preview-grid">
            <div class="logo-preview-card">
              <img class="logo-preview-thumb" src="assets/logo-h-book.jpg" alt="Logo H + Sách cũ (Phẳng)" />
              <div>
                <div class="fw-bold text-sm">Phương án chính: Chữ H + Sách mở</div>
                <div class="text-xs muted">2 gáy sách (#315B7D & #0C6980) kẹp sách mở kem cổ điển + ruy-băng vàng hồng.</div>
                <button type="button" class="btn btn-xs btn-primary mt-1" data-select-logo="assets/logo-h-book.jpg">Đặt làm Logo Header</button>
              </div>
            </div>
            <div class="logo-preview-card">
              <img class="logo-preview-thumb" src="assets/logo-h-book-alt.jpg" alt="Logo H + Sách cũ (Isometric)" />
              <div>
                <div class="fw-bold text-sm">Phương án phụ: Chữ H Isometric</div>
                <div class="text-xs muted">Góc nghiêng 3D kết hợp trang sách uốn lượn & ruy-băng vàng.</div>
                <button type="button" class="btn btn-xs btn-outline mt-1" data-select-logo="assets/logo-h-book-alt.jpg">Dùng phương án này</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Automated Test Suite Runner -->
        <div class="card mb-3">
          <div class="card-header">
            <div>
              <h3 class="card-title">Kết quả kiểm thử nghiệp vụ tự động (Section VI – ${passedCount}/${results.length} PASS)</h3>
              <p class="text-xs muted" style="margin:2px 0 0;">Mỗi test case chạy trực tiếp trên <code>Pricing Service</code> và <code>Order State Machine</code> với bản sao dữ liệu độc lập.</p>
            </div>
            <span class="badge ${passedCount === results.length ? "badge-success" : "badge-danger"}">
              ${passedCount === results.length ? `ALL ${results.length} PASSED` : `${passedCount}/${results.length} PASSED`}
            </span>
          </div>
          <div class="table-wrap" style="max-height:460px;overflow-y:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Test ID</th>
                  <th>Nhóm</th>
                  <th>Tình huống kiểm thử</th>
                  <th>Trạng thái</th>
                  <th>Kết quả thực tế từ Logic Engine</th>
                </tr>
              </thead>
              <tbody>
                ${results
                  .map(
                    (r) => `
                    <tr>
                      <td><strong><code>${r.id}</code></strong></td>
                      <td class="text-xs muted">${escapeHtml(r.group)}</td>
                      <td>${escapeHtml(r.scenario)}</td>
                      <td><span class="badge ${r.passed ? "badge-success" : "badge-danger"}">${r.passed ? "PASS" : "FAIL"}</span></td>
                      <td class="text-xs">${escapeHtml(r.detail)}</td>
                    </tr>
                  `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 3: Live Schema Inspector -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Live Schema Inspector (PRD Section IV)</h3>
              <p class="text-xs muted" style="margin:2px 0 0;">Kiểm tra cấu trúc dữ liệu thật đang lưu trong phiên Demo hiện tại (kèm đầy đủ trường snapshot & <code>dataType: "simulated"</code>).</p>
            </div>
            <select class="select" id="schemaEntitySelect" style="width:auto;min-width:240px;">
              <option value="checkoutSessions" ${viewState.schemaEntity === "checkoutSessions" ? "selected" : ""}>CheckoutSession (${state.checkoutSessions.length})</option>
              <option value="orders" ${viewState.schemaEntity === "orders" ? "selected" : ""}>Order (${state.orders.length})</option>
              <option value="orderItems" ${viewState.schemaEntity === "orderItems" ? "selected" : ""}>OrderItem (${state.orderItems.length})</option>
              <option value="escrows" ${viewState.schemaEntity === "escrows" ? "selected" : ""}>EscrowTransaction (${state.escrows.length})</option>
              <option value="payouts" ${viewState.schemaEntity === "payouts" ? "selected" : ""}>Payout (${state.payouts.length})</option>
              <option value="disputes" ${viewState.schemaEntity === "disputes" ? "selected" : ""}>Dispute (${state.disputes.length})</option>
              <option value="moderations" ${viewState.schemaEntity === "moderations" ? "selected" : ""}>ListingModeration (${state.listings.length})</option>
              <option value="hubConfig" ${viewState.schemaEntity === "hubConfig" ? "selected" : ""}>HUB_CONFIG</option>
            </select>
          </div>
          <pre class="json-viewer">${escapeHtml(selectedJson)}</pre>
        </div>
      </section>
    `;
  }

  function bindEvents(root, handlers) {
    const runBtn = root.querySelector("#btnRunAllPrdTests");
    if (runBtn) {
      runBtn.addEventListener("click", () => {
        viewState.testResults = App.Store.runPrdTestSuite();
        const pass = viewState.testResults.filter((r) => r.passed).length;
        handlers.rerender();
        handlers.toast(`Đã chạy xong ${viewState.testResults.length} test cases: ${pass}/${viewState.testResults.length} PASS.`, "success");
      });
    }

    const schemaSel = root.querySelector("#schemaEntitySelect");
    if (schemaSel) {
      schemaSel.addEventListener("change", (e) => {
        viewState.schemaEntity = e.target.value;
        handlers.rerender();
      });
    }

    root.querySelectorAll("[data-select-logo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const src = btn.getAttribute("data-select-logo");
        handlers.setBrandLogo(src);
        handlers.toast("Đã cập nhật Logo Header & Favicon.", "success");
      });
    });
  }

  App.DemoLabView = {
    render,
    bindEvents,
  };
})(window.HubApp);
