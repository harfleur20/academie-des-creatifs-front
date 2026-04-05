import {
  FaChevronLeft,
  FaChevronRight,
  FaCrown,
  FaFire,
  FaLaptop,
  FaMapMarkerAlt,
  FaTag,
  FaVideo,
} from "react-icons/fa";

import type { FormationFormat, OrderStatus, PaymentStatus, SessionState } from "../lib/catalogApi";

export function formatTypeLabel(formatType: FormationFormat) {
  if (formatType === "ligne") {
    return "Ligne";
  }

  if (formatType === "presentiel") {
    return "Presentiel";
  }

  return "Live";
}

export function dashboardTypeLabel(formatType: FormationFormat) {
  return formatType === "ligne" ? "Classique" : "Guide";
}

export function statusLabel(status: string) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function badgeLabel(badge: string) {
  if (badge === "premium") {
    return "Premium";
  }

  if (badge === "populaire") {
    return "Populaire";
  }

  return "Promo";
}

export function badgeIcon(badge: string) {
  if (badge === "premium") {
    return <FaCrown />;
  }

  if (badge === "populaire") {
    return <FaFire />;
  }

  return <FaTag />;
}

export function sessionStateLabel(state: SessionState) {
  switch (state) {
    case "unscheduled":
      return "Aucune session";
    case "upcoming":
      return "A venir";
    case "started_open":
      return "En cours / ouverte";
    case "started_closed":
      return "En cours / fermee";
    case "ended":
      return "Terminee";
    case "not_applicable":
      return "Sans session";
    default:
      return "A venir";
  }
}

export function sessionStateClassName(state: SessionState) {
  return `admin-status admin-status--session admin-status--session-${state}`;
}

export function getTotalPages(length: number, pageSize: number) {
  return Math.max(1, Math.ceil(length / pageSize));
}

export function getPageItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = getTotalPages(items.length, pageSize);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}

export function includesSearchValue(values: Array<string | number | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
}

export function buildMonthlyRevenueSeries(
  orders: Array<{ status: OrderStatus; total_amount: number; created_at: string }>,
) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatter.format(date).replace(".", ""),
      value: 0,
    };
  });
  const monthIndex = new Map(months.map((entry, index) => [entry.key, index]));

  orders.forEach((order) => {
    if (order.status !== "paid" && order.status !== "partially_paid") {
      return;
    }
    const parsedDate = new Date(order.created_at);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }
    const key = `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
    const index = monthIndex.get(key);
    if (index !== undefined) {
      months[index].value += order.total_amount;
    }
  });

  return months;
}

export function buildSparkline(values: number[], width = 420, height = 160) {
  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const paddingX = 16;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const points = safeValues.map((value, index) => {
    const x =
      safeValues.length === 1
        ? width / 2
        : paddingX + (index / (safeValues.length - 1)) * innerWidth;
    const y = paddingY + ((max - value) / range) * innerHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${points[0]?.x.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`;

  return { width, height, linePath, areaPath };
}

export function metricIcon(formatType: FormationFormat) {
  if (formatType === "live") {
    return <FaVideo />;
  }

  if (formatType === "presentiel") {
    return <FaMapMarkerAlt />;
  }

  return <FaLaptop />;
}

export function AdminTablePager({
  page,
  totalPages,
  totalItems,
  label,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="admin-table-footer">
      <p>
        {label} · <strong>{totalItems}</strong>
      </p>
      <div className="admin-pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Page precedente"
        >
          <FaChevronLeft />
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Page suivante"
        >
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}
