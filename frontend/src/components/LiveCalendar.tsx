import { useEffect, useState } from "react";

interface CalendarEvent {
  date: string; // ISO date "2026-05-12"
  label?: string;
}

interface Props {
  events: CalendarEvent[];
  onDayClick?: (date: string) => void;
  selectedDate?: string | null;
  initialDate?: string | null;
  minDate?: string | null;
  maxDate?: string | null;
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateParts(value?: string | null): { year: number; month: number } | null {
  const [year, month] = (value ?? "").slice(0, 10).split("-").map(Number);
  if (!year || !month) return null;
  return { year, month: month - 1 };
}

export default function LiveCalendar({
  events,
  onDayClick,
  selectedDate,
  initialDate,
  minDate,
  maxDate,
}: Props) {
  const today = new Date();
  const anchor = selectedDate ?? initialDate ?? events[0]?.date ?? null;
  const initialParts = parseDateParts(anchor);
  const [viewYear, setViewYear] = useState(initialParts?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialParts?.month ?? today.getMonth());

  useEffect(() => {
    const parts = parseDateParts(anchor);
    if (!parts) return;
    setViewYear(parts.year);
    setViewMonth(parts.month);
  }, [anchor]);

  const eventDates = new Set(events.map((e) => e.date.slice(0, 10)));
  const minDateValue = minDate?.slice(0, 10) ?? null;
  const maxDateValue = maxDate?.slice(0, 10) ?? null;
  const minParts = parseDateParts(minDateValue);
  const maxParts = parseDateParts(maxDateValue);

  const firstDay = new Date(viewYear, viewMonth, 1);
  // Monday-based week: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const canGoPrev =
    !minParts || viewYear > minParts.year || (viewYear === minParts.year && viewMonth > minParts.month);
  const canGoNext =
    !maxParts || viewYear < maxParts.year || (viewYear === maxParts.year && viewMonth < maxParts.month);

  function prevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="live-cal">
      <div className="live-cal__header">
        <button className="live-cal__nav" onClick={prevMonth} type="button" disabled={!canGoPrev}>‹</button>
        <span className="live-cal__month">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="live-cal__nav" onClick={nextMonth} type="button" disabled={!canGoNext}>›</button>
      </div>

      <div className="live-cal__grid">
        {DAYS.map((d) => (
          <div key={d} className="live-cal__dayname">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="live-cal__cell live-cal__cell--empty" />;
          const dateStr = toISODate(viewYear, viewMonth, day);
          const hasEvent = eventDates.has(dateStr);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isOutOfRange =
            (minDateValue !== null && dateStr < minDateValue) ||
            (maxDateValue !== null && dateStr > maxDateValue);
          return (
            <button
              key={dateStr}
              type="button"
              disabled={isOutOfRange}
              className={[
                "live-cal__cell",
                hasEvent ? "live-cal__cell--event" : "",
                isToday ? "live-cal__cell--today" : "",
                isSelected ? "live-cal__cell--selected" : "",
                isOutOfRange ? "live-cal__cell--disabled" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => {
                if (!isOutOfRange) onDayClick?.(dateStr);
              }}
            >
              {day}
              {hasEvent && <span className="live-cal__dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
