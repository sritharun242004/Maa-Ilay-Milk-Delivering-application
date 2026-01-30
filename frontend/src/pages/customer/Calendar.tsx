import React, { useEffect, useState, useCallback } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

type CalendarData = {
  pauseDaysUsed: number;
  maxPauseDays: number;
  pausedDates: string[];
  deliveryStatusByDate?: Record<string, 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED'>;
  year?: number;
  month?: number;
  currentMonth: string;
};

export const CustomerCalendar: React.FC = () => {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [saving, setSaving] = useState(false);

  const fetchCalendar = useCallback((year: number, month: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/customer/calendar?year=${year}&month=${month}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load calendar');
        return res.json();
      })
      .then(setData)
      .catch(() => setError('Could not load calendar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    fetchCalendar(year, month);
  }, [viewMonth, fetchCalendar]);

  const pausedSet = new Set(data?.pausedDates ?? []);
  const rawStatusByDate = data?.deliveryStatusByDate ?? {};
  const deliveryStatusByDate: Record<string, 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED'> = {};
  for (const [dateStr, status] of Object.entries(rawStatusByDate)) {
    const s = String(status).toUpperCase().replace(/-/g, '_');
    if (s === 'DELIVERED' || s === 'PAUSED' || s === 'NOT_DELIVERED') deliveryStatusByDate[dateStr] = s as 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED';
  }
  const maxPause = data?.maxPauseDays ?? 5;
  const pauseDaysUsed = data?.pauseDaysUsed ?? pausedSet.size;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const getDayState = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayStart = new Date(year, month, day);
    const isPast = dayStart < todayStart;
    const isToday = dayStart.getTime() === todayStart.getTime();
    const isPaused = pausedSet.has(dateStr);
    const isFuture = !isPast && !isToday;
    const deliveryStatus = deliveryStatusByDate[dateStr];
    return { dateStr, isPast, isToday, isPaused, isFuture, deliveryStatus };
  };

  const getDayClassName = (day: number) => {
    const { isPast, isToday, isPaused, isFuture, deliveryStatus } = getDayState(day);
    const base = 'aspect-square min-h-[44px] flex items-center justify-center rounded-lg font-medium transition-all border';
    let className = base;
    if (isToday) {
      className += ' border-2 border-emerald-500 bg-emerald-50 text-emerald-800 cursor-default';
    } else if (isPast) {
      if (deliveryStatus === 'DELIVERED') {
        className += ' bg-emerald-200 text-emerald-800 border-emerald-300 cursor-default';
      } else if (deliveryStatus === 'PAUSED') {
        className += ' bg-orange-200 text-orange-800 border-orange-300 cursor-default';
      } else if (deliveryStatus === 'NOT_DELIVERED') {
        className += ' bg-red-200 text-red-800 border-red-300 cursor-default';
      } else {
        className += ' bg-gray-200 text-gray-600 border-gray-300 cursor-default';
      }
    } else if (isPaused) {
      className += ' bg-orange-200 text-orange-800 border-orange-300 cursor-pointer hover:bg-orange-300';
    } else if (isFuture) {
      className += ' bg-gray-100 text-gray-700 border-gray-200 hover:bg-emerald-100 cursor-pointer';
    }
    return className;
  };

  const handleDayClick = async (day: number) => {
    const { dateStr, isPast, isFuture, isPaused } = getDayState(day);
    if (isPast) return;
    if (!isFuture && !isPaused) return;
    if (saving) return;
    if (isPaused) {
      setSaving(true);
      try {
        const res = await fetch(`/api/customer/calendar/pause?date=${encodeURIComponent(dateStr)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to remove pause');
        }
        fetchCalendar(year, month);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove pause');
      } finally {
        setSaving(false);
      }
    } else {
      if (pausedSet.size >= maxPause) return;
      setSaving(true);
      try {
        const res = await fetch('/api/customer/calendar/pause', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to add pause');
        }
        fetchCalendar(year, month);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add pause');
      } finally {
        setSaving(false);
      }
    }
  };

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  if (loading && !data) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[40vh]">
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (error && !data) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-red-600">{error}</p>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Delivery Calendar</h1>
          <p className="text-gray-600">Pause delivery on specific dates (data from your account)</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-orange-800">
            Changes apply only if done before 5 PM previous day. Click upcoming dates to pause or unpause. All data is saved to your account and matches History.
          </p>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-lg font-semibold text-gray-900">Pause Days Used</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-emerald-600">
                {pauseDaysUsed}/{maxPause}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(pauseDaysUsed / maxPause) * 100}%` }}
            />
          </div>
        </Card>

        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{monthLabel}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              return (
                <button
                  key={day}
                  type="button"
                  className={getDayClassName(day)}
                  onClick={() => handleDayClick(day)}
                  disabled={saving}
                >
                  {day}
                </button>
              );
            })}
          </div>

        </Card>

        {saving && (
          <p className="text-sm text-gray-500 mt-4">Saving...</p>
        )}
      </div>
    </CustomerLayout>
  );
};
