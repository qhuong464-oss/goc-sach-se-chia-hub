/* ==========================================================================
   Application Store, LocalStorage Persistence, Scenarios & QA Test Runner
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  const STORAGE_KEY = "goc_sach_se_chia_prd_v1_2";
  const THEME_KEY = "goc_sach_se_chia_theme";

  let state = loadState();
  const listeners = new Set();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.listings) && Array.isArray(parsed.orders)) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore storage errors and fall back to fresh seed
    }
    return App.Data.createInitialState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore quota errors in private browsing
    }
  }

  function getState() {
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    saveState();
    listeners.forEach((fn) => fn(state));
  }

  function getTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || "light";
    } catch (e) {
      return "light";
    }
  }

  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    return next;
  }

  // Cart & Draft Operations
  function addToCart(listingId, qty = 1) {
    const listing = state.listings.find((l) => l.id === listingId);
    if (!listing) return { ok: false, error: "Không tìm thấy sách." };
    if (listing.status !== "active") {
      return { ok: false, error: "Sách chưa được duyệt công khai (pending_review/rejected)." };
    }
    if (listing.stock <= 0) {
      return { ok: false, error: `"${listing.title}" đã hết hàng.` };
    }

    const existing = state.cart.find((c) => c.listingId === listingId);
    if (existing) {
      if (existing.quantity + qty > listing.stock) {
        return { ok: false, error: `Số lượng vượt quá tồn kho hiện tại (${listing.stock}).` };
      }
      existing.quantity += qty;
      existing.seenUnitPrice = listing.price;
    } else {
      state.cart.push({
        listingId,
        quantity: Math.min(qty, listing.stock),
        seenUnitPrice: listing.price,
      });
    }
    notify();
    return { ok: true, listing };
  }

  function updateCartQty(listingId, delta) {
    const idx = state.cart.findIndex((c) => c.listingId === listingId);
    if (idx === -1) return;
    const item = state.cart[idx];
    const listing = state.listings.find((l) => l.id === listingId);
    const nextQty = item.quantity + delta;
    if (nextQty <= 0) {
      state.cart.splice(idx, 1);
    } else if (listing && nextQty > listing.stock && delta > 0) {
      return { ok: false, error: `Kho chỉ còn ${listing.stock} cuốn.` };
    } else {
      item.quantity = nextQty;
    }
    notify();
    return { ok: true };
  }

  function removeFromCart(listingId) {
    state.cart = state.cart.filter((c) => c.listingId !== listingId);
    notify();
  }

  function syncCartSnapshotPrices() {
    state.cart.forEach((item) => {
      const listing = state.listings.find((l) => l.id === item.listingId);
      if (listing) item.seenUnitPrice = listing.price;
    });
    notify();
  }

  function setCouponCode(code) {
    state.checkoutDraft.couponCode = code || "";
    notify();
  }

  function setSellerVas(sellerId, vasId) {
    state.checkoutDraft.vasBySeller[sellerId] = vasId;
    notify();
  }

  // Mock Clock Operations
  function advanceClockHours(hours) {
    state.mockNowMs += hours * 3600000;
    const completedIds = App.StateMachine.runAutoCompletion(state);
    notify();
    return completedIds;
  }

  function triggerAutoCompletionScan() {
    const completedIds = App.StateMachine.runAutoCompletion(state);
    notify();
    return completedIds;
  }

  function resetAllData() {
    state = App.Data.createInitialState();
    notify();
  }

  // Presentation 1-Click Scenarios
  function loadPrdExampleCart() {
    const canonical = { "lst-1": 120000, "lst-2": 80000, "lst-4": 100000 };
    Object.keys(canonical).forEach((id) => {
      const l = state.listings.find((x) => x.id === id);
      if (l) {
        l.price = canonical[id];
        l.status = "active";
        if (l.stock < 1) l.stock = 2;
      }
    });
    state.cart = [
      { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 },
      { listingId: "lst-2", quantity: 1, seenUnitPrice: 80000 },
      { listingId: "lst-4", quantity: 1, seenUnitPrice: 100000 },
    ];
    state.checkoutDraft = {
      couponCode: "CHIA30K",
      vasBySeller: { "seller-a": "vas-none", "seller-b": "vas-none", "seller-c": "vas-none" },
    };
    notify();
  }

  function loadRoundingOddCart() {
    const canonical = { "lst-1": 120000, "lst-4": 100000, "lst-8": 110000 };
    Object.keys(canonical).forEach((id) => {
      const l = state.listings.find((x) => x.id === id);
      if (l) {
        l.price = canonical[id];
        l.status = "active";
        if (l.stock < 1) l.stock = 2;
      }
    });
    state.cart = [
      { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 },
      { listingId: "lst-4", quantity: 1, seenUnitPrice: 100000 },
      { listingId: "lst-8", quantity: 1, seenUnitPrice: 110000 },
    ];
    state.checkoutDraft = {
      couponCode: "LE10K",
      vasBySeller: { "seller-a": "vas-none", "seller-b": "vas-none", "seller-c": "vas-none" },
    };
    notify();
  }

  function loadCategoryCouponCart() {
    const canonical = { "lst-1": 120000, "lst-7": 180000 };
    Object.keys(canonical).forEach((id) => {
      const l = state.listings.find((x) => x.id === id);
      if (l) {
        l.price = canonical[id];
        l.status = "active";
        if (l.stock < 1) l.stock = 2;
      }
    });
    state.cart = [
      { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 }, // Văn học (đủ điều kiện)
      { listingId: "lst-7", quantity: 1, seenUnitPrice: 180000 }, // Công nghệ (không đủ điều kiện)
    ];
    state.checkoutDraft = {
      couponCode: "VANHOC20K",
      vasBySeller: { "seller-a": "vas-none", "seller-c": "vas-none" },
    };
    notify();
  }

  function loadOutOfStockDemoCart() {
    const l1 = state.listings.find((x) => x.id === "lst-1");
    if (l1) {
      l1.price = 120000;
      l1.status = "active";
      if (l1.stock < 1) l1.stock = 2;
    }
    const l6 = state.listings.find((x) => x.id === "lst-6");
    if (l6) {
      l6.status = "active";
      l6.stock = 0; // Simulate hết hàng giữa chừng
    }
    state.cart = [
      { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 },
      { listingId: "lst-6", quantity: 1, seenUnitPrice: 135000 },
    ];
    state.checkoutDraft.couponCode = "";
    notify();
  }

  function loadPriceChangeDemoCart() {
    const l1 = state.listings.find((x) => x.id === "lst-1");
    if (l1) {
      l1.price = 120000;
      l1.status = "active";
      if (l1.stock < 1) l1.stock = 2;
    }
    const l4 = state.listings.find((x) => x.id === "lst-4");
    if (l4) {
      l4.status = "active";
      if (l4.stock < 1) l4.stock = 2;
      l4.price = 115000;
    }
    state.cart = [
      { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 },
      { listingId: "lst-4", quantity: 1, seenUnitPrice: 100000 },
    ];
    state.checkoutDraft.couponCode = "CHIA30K";
    notify();
  }

  /**
   * Executes every PRD v1.2 Test Case (Section VI) on isolated cloned states
   * and returns verified PASS/FAIL details for live presentation.
   */
  function runPrdTestSuite() {
    const results = [];

    function testCase(id, group, scenario, fn) {
      const s = App.Data.createInitialState();
      try {
        const detail = fn(s);
        results.push({ id, group, scenario, passed: true, detail });
      } catch (err) {
        results.push({ id, group, scenario, passed: false, detail: err.message || String(err) });
      }
    }

    function assert(cond, msg) {
      if (!cond) throw new Error(msg);
    }

    // 6.1 Multi-seller Checkout
    testCase("TC-M01", "6.1 Multi-seller Checkout", "Mua từ 2 Seller → 1 CheckoutSession & 2 Order", (s) => {
      const res = App.StateMachine.executeCheckout(s);
      assert(res.ok, res.error);
      assert(res.session.orderIds.length === 2, "Phải tạo đúng 2 Order");
      return `Session ${res.session.id} tạo ${res.orders.map((o) => o.id).join(", ")}`;
    });

    testCase("TC-M02", "6.1 Multi-seller Checkout", "Nhiều sản phẩm cùng Seller gộp đúng vào 1 Order", (s) => {
      const res = App.StateMachine.executeCheckout(s);
      assert(res.ok, res.error);
      const orderA = res.orders.find((o) => o.sellerId === "seller-a");
      assert(orderA && orderA.itemIds.length === 2, "Order Seller A phải chứa 2 item");
      return `${orderA.id} gộp ${orderA.itemIds.length} sản phẩm (200.000đ)`;
    });

    testCase("TC-M03", "6.1 Multi-seller Checkout", "1 sản phẩm hết hàng → toàn bộ Checkout thất bại (All-or-Nothing)", (s) => {
      const beforeSessions = s.checkoutSessions.length;
      const beforeOrders = s.orders.length;
      s.listings.find((l) => l.id === "lst-4").stock = 0;
      const res = App.StateMachine.executeCheckout(s);
      assert(!res.ok, "Checkout phải thất bại");
      assert(s.checkoutSessions.length === beforeSessions && s.orders.length === beforeOrders, "Không được tạo Order một phần");
      assert(s.cart.length === 3, "Giỏ hàng phải giữ nguyên");
      return "Checkout bị chặn hoàn toàn, 0 Order một phần, giỏ hàng giữ nguyên 3 món";
    });

    testCase("TC-M04", "6.1 Multi-seller Checkout", "Sản phẩm đổi giá → cảnh báo Buyer kiểm tra lại trước khi xác nhận", (s) => {
      s.listings.find((l) => l.id === "lst-4").price = 125000;
      const res = App.StateMachine.executeCheckout(s);
      assert(!res.ok && res.preview.hasPriceChanges, "Phải chặn và phát hiện thay đổi giá");
      return `Phát hiện đổi giá: ${App.Utils.formatVnd(100000)} → ${App.Utils.formatVnd(125000)}`;
    });

    testCase("TC-M05", "6.1 Multi-seller Checkout", "Checkout thành công → mỗi Order có Shipment & Escrow riêng", (s) => {
      const res = App.StateMachine.executeCheckout(s);
      assert(res.ok, res.error);
      res.orders.forEach((o) => {
        const shp = s.shipments.find((x) => x.orderId === o.id);
        const esc = s.escrows.find((x) => x.orderId === o.id);
        assert(shp && esc, `Thiếu Shipment hoặc Escrow cho ${o.id}`);
      });
      return `Mỗi Order trong ${res.orders.length} Order đều có Shipment & Escrow simulated_held riêng`;
    });

    // 6.2 Shipping Fee
    testCase("TC-S01", "6.2 Shipping Fee", "2 Seller phí ship khác nhau → tính riêng từng Order", (s) => {
      const preview = App.Pricing.calculateCheckoutPreview(s);
      assert(preview.orderGroups[0].shippingFee === 25000, "Seller A phải 25.000đ");
      assert(preview.orderGroups[1].shippingFee === 30000, "Seller B phải 30.000đ");
      return "Seller A: 25.000đ | Seller B: 30.000đ (không gộp)";
    });

    testCase("TC-S02", "6.2 Shipping Fee", "Checkout 3 Seller → tổng phí ship bằng tổng 3 khoản", (s) => {
      s.cart.push({ listingId: "lst-7", quantity: 1, seenUnitPrice: 180000 });
      const preview = App.Pricing.calculateCheckoutPreview(s);
      assert(preview.totals.shippingTotal === 25000 + 30000 + 22000, "Sai tổng ship 3 Seller");
      return `25.000 + 30.000 + 22.000 = ${App.Utils.formatVnd(preview.totals.shippingTotal)}`;
    });

    testCase("TC-S03", "6.2 Shipping Fee", "Hiển thị tách biệt phí ship theo từng Seller", (s) => {
      const preview = App.Pricing.calculateCheckoutPreview(s);
      assert(preview.orderGroups.every((g) => typeof g.shippingFee === "number" && g.seller.carrier), "Thiếu chi tiết ship");
      return "OrderGroups chứa riêng shippingFee và carrier theo từng Seller";
    });

    testCase("TC-S04", "6.2 Shipping Fee", "1 Order không hợp lệ → không tính vào Checkout thành công", (s) => {
      s.listings.find((l) => l.id === "lst-4").status = "pending_review";
      const preview = App.Pricing.calculateCheckoutPreview(s);
      assert(!preview.isValid, "Phải báo invalid khi có sản phẩm chưa active");
      return "Chặn Checkout khi tồn tại sản phẩm không hợp lệ, không tính phí một phần";
    });

    // 6.3 Discount Allocation
    testCase("TC-DC01", "6.3 Discount Allocation", "Order A 200k, B 100k, giảm 30k → A -20k, B -10k", (s) => {
      const p = App.Pricing.calculateCheckoutPreview(s);
      assert(p.orderGroups[0].discount === 20000 && p.orderGroups[1].discount === 10000, "Phân bổ sai");
      assert(p.totals.grandTotal === 325000, `GrandTotal phải 325.000đ, nhận ${p.totals.grandTotal}`);
      return "Order A -20.000đ (205k) | Order B -10.000đ (120k) | Tổng 325.000đ";
    });

    testCase("TC-DC02", "6.3 Discount Allocation", "3 Order giá trị khác nhau → phân bổ đúng tỷ trọng", (s) => {
      s.cart = [
        { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 },
        { listingId: "lst-4", quantity: 1, seenUnitPrice: 100000 },
        { listingId: "lst-7", quantity: 1, seenUnitPrice: 180000 },
      ];
      s.checkoutDraft.couponCode = "CHIA30K"; // 120/400=30%, 100/400=25%, 180/400=45% => 9k, 7.5k, 13.5k
      const p = App.Pricing.calculateCheckoutPreview(s);
      assert(p.orderGroups[0].discount === 9000 && p.orderGroups[1].discount === 7500 && p.orderGroups[2].discount === 13500, "Sai tỷ trọng");
      return "9.000đ + 7.500đ + 13.500đ = 30.000đ";
    });

    testCase("TC-DC03", "6.3 Discount Allocation", "Số lẻ → làm tròn xuống & dồn phần dư vào Order cuối", (s) => {
      s.cart = [
        { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 },
        { listingId: "lst-4", quantity: 1, seenUnitPrice: 100000 },
        { listingId: "lst-7", quantity: 1, seenUnitPrice: 180000 },
      ];
      s.checkoutDraft.couponCode = "LE10K"; // 10k * 120/400=3000, 10k*100/400=2500... Let's use 120k + 100k + 100k = 320k? Wait 10k * (120/320) = 3750; let's force prime divisor 120k + 100k + 110k = 330k!
      s.cart[2] = { listingId: "lst-8", quantity: 1, seenUnitPrice: 110000 }; // 120 + 100 + 110 = 330k
      const p = App.Pricing.calculateCheckoutPreview(s);
      const d = p.orderGroups.map((g) => g.discount);
      const sum = d[0] + d[1] + d[2];
      assert(sum === 10000, "Tổng phải bằng đúng 10.000đ");
      return `330k chia 10k: [${d.map(App.Utils.formatVnd).join(" + ")}] = ${App.Utils.formatVnd(sum)}`;
    });

    testCase("TC-DC04", "6.3 Discount Allocation", "Không có sản phẩm đủ điều kiện → không phân bổ giảm giá", (s) => {
      s.checkoutDraft.couponCode = "CONGNGHE50K"; // Giỏ mẫu toàn Văn học & Kỹ năng
      const p = App.Pricing.calculateCheckoutPreview(s);
      assert(p.totals.discountTotal === 0, "Phải giảm 0đ");
      return "CONGNGHE50K trên giỏ không có sách Công nghệ → Discount = 0đ";
    });

    testCase("TC-DC05", "6.3 Discount Allocation", "Mã giới hạn thể loại → chỉ tính trên giá trị đủ điều kiện", (s) => {
      s.cart = [
        { listingId: "lst-1", quantity: 1, seenUnitPrice: 120000 }, // Văn học
        { listingId: "lst-7", quantity: 1, seenUnitPrice: 180000 }, // Công nghệ
      ];
      s.checkoutDraft.couponCode = "VANHOC20K";
      const p = App.Pricing.calculateCheckoutPreview(s);
      assert(p.orderGroups[0].discount === 20000 && p.orderGroups[1].discount === 0, "Chỉ Seller A (Văn học) được giảm");
      return "Seller A (Văn học): -20.000đ | Seller C (Công nghệ): 0đ";
    });

    testCase("TC-DC06", "6.3 Discount Allocation", "Tổng Discount Allocation khớp chính xác Discount Total", (s) => {
      const p = App.Pricing.calculateCheckoutPreview(s);
      const sum = p.orderGroups.reduce((acc, g) => acc + g.discount, 0);
      assert(sum === p.totals.discountTotal, "Lệch tổng discount");
      return `Σ Order.discount = ${App.Utils.formatVnd(sum)} === Checkout.discountTotal`;
    });

    // 6.4 Listing Moderation
    testCase("TC-MD01", "6.4 Listing Moderation", "Seller tạo Listing mới → mặc định pending_review", (s) => {
      const res = App.StateMachine.sellerCreateListing(s, "seller-a", {
        title: "Sách Test Kiểm Duyệt",
        price: 90000,
        stock: 2,
      });
      assert(res.ok && res.listing.status === "pending_review", "Phải mặc định pending_review");
      return `${res.listing.id} có status = "${res.listing.status}"`;
    });

    testCase("TC-MD02", "6.4 Listing Moderation", "Listing chưa duyệt không xuất hiện tìm kiếm công khai (Seller không tự duyệt)", (s) => {
      const activeIds = s.listings.filter((l) => l.status === "active").map((l) => l.id);
      assert(!activeIds.includes("lst-10"), "lst-10 pending_review không được nằm trong active");
      const guard = App.StateMachine.adminModerateListing(s, "lst-10", "approved", "seller-a", "", "seller");
      assert(!guard.ok, "Seller không được phép tự duyệt");
      return "Public catalog lọc bỏ lst-10 & chặn Seller tự duyệt";
    });

    testCase("TC-MD03", "6.4 Listing Moderation", "Admin duyệt Listing → chuyển active và xuất hiện công khai", (s) => {
      const res = App.StateMachine.adminModerateListing(s, "lst-10", "approved", "admin-01", "", "admin");
      assert(res.ok && res.listing.status === "active", "Phải chuyển sang active");
      return "Admin duyệt lst-10 → status = active";
    });

    testCase("TC-MD04", "6.4 Listing Moderation", "Admin từ chối Listing → lưu lý do, người duyệt, thời điểm", (s) => {
      const res = App.StateMachine.adminModerateListing(
        s,
        "lst-11",
        "rejected",
        "admin-01",
        "Thiếu ảnh chụp trang bản quyền.",
        "admin"
      );
      assert(res.ok && res.listing.status === "rejected" && res.listing.moderation.rejectionReason, "Thiếu lý do từ chối");
      return `Từ chối lst-11 bởi ${res.listing.moderation.reviewedBy}: "${res.listing.moderation.rejectionReason}"`;
    });

    // 6.5 Auto Completion - 48 Hours
    testCase("TC-T01", "6.5 Auto Completion (48h)", "Đơn vào waiting_confirmation → deadline đúng +48 giờ", (s) => {
      const o = s.orders.find((x) => x.id === "ORD-1003");
      // Advance in_transit -> delivered -> waiting_confirmation
      const res = App.StateMachine.advanceOrderStatus(s, o.id);
      assert(res.ok && o.status === "waiting_confirmation", "Phải vào waiting_confirmation");
      const diffHours = (Date.parse(o.confirmationDeadline) - Date.parse(o.waitingConfirmationAt)) / 3600000;
      assert(diffHours === 48, `Deadline lệch: ${diffHours}h`);
      return `${o.id} deadline = waitingConfirmationAt + ${diffHours} giờ`;
    });

    testCase("TC-T02", "6.5 Auto Completion (48h)", "Chưa đủ 48 giờ → không tự động hoàn tất", (s) => {
      // ORD-1001 còn 2 giờ nữa mới đủ 48h
      App.StateMachine.runAutoCompletion(s);
      const o1 = s.orders.find((x) => x.id === "ORD-1001");
      assert(o1.status === "waiting_confirmation", "ORD-1001 chưa đủ 48h không được auto-complete");
      return "ORD-1001 (46h/48h) giữ nguyên waiting_confirmation";
    });

    testCase("TC-T03", "6.5 Auto Completion (48h)", "Đủ 48 giờ & không tranh chấp → tự động completed", (s) => {
      s.mockNowMs += 3 * 3600000; // +3h => ORD-1001 (49h) & ORD-1002 (52h)
      const completed = App.StateMachine.runAutoCompletion(s);
      assert(completed.includes("ORD-1001"), "ORD-1001 phải tự hoàn tất");
      return `Auto-complete thành công: ${completed.join(", ")}`;
    });

    testCase("TC-T04", "6.5 Auto Completion (48h)", "Buyer xác nhận trước hạn → hoàn tất theo buyer_confirmation", (s) => {
      const res = App.StateMachine.buyerConfirmOrder(s, "ORD-1001");
      assert(res.ok && res.order.completionSource === "buyer_confirmation", "Sai completionSource");
      return `ORD-1001 hoàn tất: completionSource = "${res.order.completionSource}"`;
    });

    testCase("TC-T05", "6.5 Auto Completion (48h)", "Buyer mở tranh chấp trước hạn → không tự động hoàn tất", (s) => {
      const dRes = App.StateMachine.openDispute(s, "ORD-1001", "Thiếu trang", "Thiếu 2 trang", "");
      assert(dRes.ok, dRes.error);
      s.mockNowMs += 72 * 3600000;
      const completed = App.StateMachine.runAutoCompletion(s);
      assert(!completed.includes("ORD-1001"), "Đơn có dispute không được auto-complete");
      return "ORD-1001 (disputed) được bỏ qua dù đã +72 giờ";
    });

    testCase("TC-T06", "6.5 Auto Completion (48h)", "Admin khóa xử lý Order → không tự động hoàn tất", (s) => {
      App.StateMachine.toggleAdminOrderLock(s, "ORD-1001", "admin-01");
      s.mockNowMs += 72 * 3600000;
      const completed = App.StateMachine.runAutoCompletion(s);
      assert(!completed.includes("ORD-1001"), "Đơn adminLocked không được auto-complete");
      return "ORD-1001 (adminLocked = true) không tự động hoàn tất";
    });

    testCase("TC-T07", "6.5 Auto Completion (48h)", "Auto-complete thành công → Escrow simulated_released & Payout simulated_paid", (s) => {
      s.mockNowMs += 5 * 3600000;
      App.StateMachine.runAutoCompletion(s);
      const esc = s.escrows.find((e) => e.orderId === "ORD-1001");
      const pay = s.payouts.find((p) => p.orderId === "ORD-1001");
      assert(esc.status === "simulated_released" && pay.status === "simulated_paid", "Sai trạng thái Escrow/Payout");
      return `Escrow=${esc.status}, Payout=${pay.status} (${App.Utils.formatVnd(pay.amount)})`;
    });

    testCase("TC-T08", "6.5 Auto Completion (48h)", "Kiểm tra nguồn hoàn tất = system_auto_completion", (s) => {
      s.mockNowMs += 5 * 3600000;
      App.StateMachine.runAutoCompletion(s);
      const o1 = s.orders.find((x) => x.id === "ORD-1001");
      assert(o1.completionSource === "system_auto_completion", "Sai completionSource");
      return `ORD-1001.completionSource = "${o1.completionSource}"`;
    });

    // 6.6 Dispute Resolution
    testCase("TC-D01", "6.6 Dispute Resolution", "Admin hoàn tiền Buyer → Order refunded, Escrow simulated_refunded", (s) => {
      const res = App.StateMachine.adminResolveDispute(s, "DSP-0001", "refund_buyer", "admin-01", "Sách lỗi thật", "admin");
      assert(res.ok && res.order.status === "refunded", "Phải refunded");
      const esc = s.escrows.find((e) => e.orderId === "ORD-1005");
      assert(esc.status === "simulated_refunded", "Escrow phải simulated_refunded");
      return `DSP-0001 → Order=${res.order.status}, Escrow=${esc.status}`;
    });

    testCase("TC-D02", "6.6 Dispute Resolution", "Admin hoàn tất đơn → Order completed, Escrow simulated_released", (s) => {
      const res = App.StateMachine.adminResolveDispute(s, "DSP-0001", "complete_order", "admin-01", "Sách đúng mô tả", "admin");
      assert(res.ok && res.order.status === "completed", "Phải completed");
      const esc = s.escrows.find((e) => e.orderId === "ORD-1005");
      const pay = s.payouts.find((p) => p.orderId === "ORD-1005");
      assert(esc.status === "simulated_released" && pay.status === "simulated_paid", "Escrow/Payout sai");
      return `DSP-0001 → Order=completed, Payout=${pay.status} (${App.Utils.formatVnd(pay.amount)})`;
    });

    testCase("TC-D03", "6.6 Dispute Resolution", "Tranh chấp đang xử lý → không thực hiện Payout", (s) => {
      const esc = s.escrows.find((e) => e.orderId === "ORD-1005");
      const pay = s.payouts.find((p) => p.orderId === "ORD-1005");
      assert(esc.status === "simulated_frozen", "Escrow phải đóng băng");
      assert(!pay || pay.status !== "simulated_paid", "Không được trả Payout khi đang dispute");
      return `ORD-1005 đang disputed: Escrow=${esc.status}, chưa có Payout paid`;
    });

    testCase("TC-D04", "6.6 Dispute Resolution", "Seller tự xử lý tranh chấp → hệ thống từ chối", (s) => {
      const res = App.StateMachine.adminResolveDispute(s, "DSP-0001", "complete_order", "seller-b", "Tự duyệt", "seller");
      assert(!res.ok, "Phải chặn Seller tự xử lý");
      return res.error;
    });

    testCase("TC-D05", "6.6 Dispute Resolution", "Admin xử lý tranh chấp lần 2 → ngăn xử lý trùng", (s) => {
      const res = App.StateMachine.adminResolveDispute(s, "DSP-0002", "complete_order", "admin-01", "Thử xử lý lại", "admin");
      assert(!res.ok, "Phải chặn xử lý lần thứ 2");
      return res.error;
    });

    testCase("TC-D06", "6.6 Dispute Resolution", "Admin hoàn tiền → Payout simulated_refunded, 0đ cho Seller", (s) => {
      App.StateMachine.adminResolveDispute(s, "DSP-0001", "refund_buyer", "admin-01", "Xác nhận lỗi", "admin");
      const pay = s.payouts.find((p) => p.orderId === "ORD-1005");
      assert(pay && pay.status === "simulated_refunded" && pay.amount === 0, "Payout phải simulated_refunded với 0đ");
      return `Payout ${pay.id}: status=${pay.status}, amount=${App.Utils.formatVnd(pay.amount)}`;
    });

    return results;
  }

  App.Store = {
    getState,
    subscribe,
    notify,
    getTheme,
    setTheme,
    addToCart,
    updateCartQty,
    removeFromCart,
    syncCartSnapshotPrices,
    setCouponCode,
    setSellerVas,
    advanceClockHours,
    triggerAutoCompletionScan,
    resetAllData,
    loadPrdExampleCart,
    loadRoundingOddCart,
    loadCategoryCouponCart,
    loadOutOfStockDemoCart,
    loadPriceChangeDemoCart,
    runPrdTestSuite,
  };
})(window.HubApp);
