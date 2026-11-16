/* ==========================================================================
   Central Configuration & Shared Utilities (PRD v1.2 Section 4.8 & 2.5)
   ========================================================================== */

window.HubApp = window.HubApp || {};

(function (App) {
  "use strict";

  const HUB_CONFIG = Object.freeze({
    ORDER_CONFIRMATION_TIMEOUT_HOURS: 48,
    SHIPPING_FEE_MODE: "PER_ORDER",
    DISCOUNT_ALLOCATION_MODE: "PROPORTIONAL_TO_ORDER_SUBTOTAL",
    TRANSACTION_COMMISSION_RATE: 0,
    DATA_MODE: "SIMULATED",
  });

  const BRAND_TOKENS = Object.freeze([
    { token: "Primary Blue", hex: "#315B7D", usage: "CTA, Navigation, Heading" },
    { token: "Background Cream", hex: "#FAF7EF", usage: "Background (Light Mode)" },
    { token: "Accent Pink", hex: "#FFC2C2", usage: "Highlight" },
    { token: "Accent Teal", hex: "#0C6980", usage: "Thông tin phụ" },
    { token: "Accent Yellow", hex: "#FFD483", usage: "Highlight" },
    { token: "Primary Text", hex: "#282120", usage: "Nội dung chính" },
  ]);

  const ORDER_STATUS_META = Object.freeze({
    pending_seller: { label: "Chờ Seller xác nhận", badge: "badge-info", next: "confirmed", nextLabel: "Xác nhận đơn" },
    confirmed: { label: "Seller đã xác nhận", badge: "badge-info", next: "ready_for_pickup", nextLabel: "Chuẩn bị xong" },
    ready_for_pickup: { label: "Sẵn sàng lấy hàng", badge: "badge-teal", next: "picked_up", nextLabel: "Shipper đã lấy" },
    picked_up: { label: "Đã lấy hàng", badge: "badge-teal", next: "in_transit", nextLabel: "Đang vận chuyển" },
    in_transit: { label: "Đang giao hàng", badge: "badge-teal", next: "delivered", nextLabel: "Giao thành công (→ Chờ xác nhận)" },
    delivered: { label: "Đã giao", badge: "badge-warn", next: "waiting_confirmation", nextLabel: "Chuyển chờ xác nhận" },
    waiting_confirmation: { label: "Chờ Buyer xác nhận (48h)", badge: "badge-warn", next: null, nextLabel: null },
    completed: { label: "Hoàn tất", badge: "badge-success", next: null, nextLabel: null },
    disputed: { label: "Đang tranh chấp", badge: "badge-danger", next: null, nextLabel: null },
    refunded: { label: "Đã hoàn tiền Buyer", badge: "badge-danger", next: null, nextLabel: null },
    cancelled: { label: "Đã hủy", badge: "badge-danger", next: null, nextLabel: null },
  });

  const ESCROW_STATUS_META = Object.freeze({
    simulated_held: { label: "simulated_held (Đang giữ)", badge: "badge-info" },
    simulated_frozen: { label: "simulated_frozen (Đóng băng)", badge: "badge-danger" },
    simulated_released: { label: "simulated_released (Đã giải ngân)", badge: "badge-success" },
    simulated_refunded: { label: "simulated_refunded (Đã hoàn Buyer)", badge: "badge-danger" },
  });

  const PAYOUT_STATUS_META = Object.freeze({
    simulated_pending: { label: "simulated_pending", badge: "badge-warn" },
    simulated_paid: { label: "simulated_paid (Đã trả Seller)", badge: "badge-success" },
    simulated_refunded: { label: "simulated_refunded", badge: "badge-danger" },
    simulated_cancelled: { label: "simulated_cancelled", badge: "badge-danger" },
  });

  const COMPLETION_SOURCE_LABELS = Object.freeze({
    buyer_confirmation: "buyer_confirmation (Buyer tự xác nhận)",
    system_auto_completion: "system_auto_completion (Hệ thống tự động sau 48h)",
    admin_resolution: "admin_resolution (Admin phán quyết)",
  });

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatVnd(amount) {
    const num = Math.round(Number(amount) || 0);
    return num.toLocaleString("vi-VN") + "đ";
  }

  function formatDateTime(isoString) {
    if (!isoString) return "--";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString("vi-VN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRemainingTime(deadlineIso, nowMs) {
    if (!deadlineIso) return { expired: false, text: "--" };
    const diffMs = Date.parse(deadlineIso) - nowMs;
    if (diffMs <= 0) {
      const overdueHours = Math.floor(Math.abs(diffMs) / 3600000);
      const overdueMins = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
      return {
        expired: true,
        diffMs,
        text: `Quá hạn ${overdueHours}g ${overdueMins}p`,
      };
    }
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return {
      expired: false,
      diffMs,
      text: `Còn ${hours}g ${String(mins).padStart(2, "0")}p ${String(secs).padStart(2, "0")}s`,
    };
  }

  function nextId(prefix, seq) {
    return `${prefix}-${String(seq).padStart(4, "0")}`;
  }

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function renderBookCoverSvg(listing) {
    const bg = (listing.coverPalette && listing.coverPalette[0]) || "#315B7D";
    const accent = (listing.coverPalette && listing.coverPalette[1]) || "#FFD483";
    const safeTitle = escapeHtml((listing.title || "Sách cũ").slice(0, 26));
    const safeAuthor = escapeHtml((listing.author || "Tác giả").slice(0, 22));
    const safeCat = escapeHtml((listing.category || "Sách").toUpperCase().slice(0, 16));

    return `
      <svg class="book-cover-svg" viewBox="0 0 110 148" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeTitle}">
        <rect x="6" y="4" width="98" height="140" rx="6" fill="${bg}" />
        <rect x="6" y="4" width="12" height="140" rx="3" fill="rgba(0,0,0,0.22)" />
        <rect x="24" y="16" width="68" height="4" rx="2" fill="${accent}" />
        <text x="24" y="34" fill="${accent}" font-size="7.5" font-weight="700" font-family="'Be Vietnam Pro', 'Segoe UI', Tahoma, sans-serif">${safeCat}</text>
        <foreignObject x="23" y="42" width="73" height="64">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color:#FFFFFF;font-family:'Lora', 'Times New Roman', serif;font-size:10.5px;font-weight:700;line-height:1.25;word-break:break-word;">
            ${safeTitle}
          </div>
        </foreignObject>
        <line x1="24" y1="115" x2="92" y2="115" stroke="rgba(255,255,255,0.35)" stroke-width="1" />
        <text x="24" y="129" fill="rgba(255,255,255,0.88)" font-size="7.5" font-family="'Be Vietnam Pro', 'Segoe UI', Tahoma, sans-serif">${safeAuthor}</text>
      </svg>
    `;
  }

  App.HUB_CONFIG = HUB_CONFIG;
  App.BRAND_TOKENS = BRAND_TOKENS;
  App.ORDER_STATUS_META = ORDER_STATUS_META;
  App.ESCROW_STATUS_META = ESCROW_STATUS_META;
  App.PAYOUT_STATUS_META = PAYOUT_STATUS_META;
  App.COMPLETION_SOURCE_LABELS = COMPLETION_SOURCE_LABELS;
  App.Utils = {
    escapeHtml,
    formatVnd,
    formatDateTime,
    formatRemainingTime,
    nextId,
    cloneDeep,
    renderBookCoverSvg,
  };
})(window.HubApp);
