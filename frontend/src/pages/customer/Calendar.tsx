import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ChevronLeft, ChevronRight, AlertCircle, Calendar as CalendarIcon, Info, X, CheckCircle2, Loader2 } from 'lucide-react';
import { useCalendarData, invalidateCalendarCache } from '../../hooks/useCachedData';
import { fetchWithCsrf, clearCsrfToken } from '../../utils/csrf';
import { getApiUrl } from '../../config/api';

type CalendarData = {
  pauseDaysUsed: number;
  pausedDates: string[];
  baseQuantityMl: number;
  modificationsByDate: Record<string, {
    quantityMl: number;
    largeBottles: number;
    smallBottles: number;
    notes?: string;
  }>;
  deliveryStatusByDate?: Record<string, 'DELIVERED' | 'PAUSED' | 'NOT_DELIVERED' | 'SCHEDULED'>;
  year?: number;
  month?: number;
  currentMonth: string;
};

export const CustomerCalendar: React.FC = () => {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [saving, setSaving] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [pauseHistory, setPauseHistory] = useState<Array<{date: string, pausedAt: string}>>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchCalendar = useCallback((year: number, month: number, isSilent = false) => {
    if (isSilent) setRefreshing(true);
    else setLoading(true);

    setError(null);

    // Create AbortController for cleanup
    const controller = new AbortController();

    fetch(getApiUrl(`/api/customer/calendar?year=${year}&month=${month}`), {
      credentials: 'include',
      signal: controller.signal
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load calendar');
        return res.json();
      })
      .then((newData) => {
        setData(newData);
      })
      .catch((err) => {
        // Ignore abort errors
        if (err.name !== 'AbortError') {
          setError('Could not load calendar data. Please try again.');
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    // Return cleanup function
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cleanupCalendar = fetchCalendar(viewMonth.getFullYear(), viewMonth.getMonth());
    const cleanupHistory = fetchPauseHistory();
    setSelectedDates(new Set());

    // Cleanup function to abort requests if component unmounts
    return () => {
      cleanupCalendar?.();
      cleanupHistory?.();
    };
  }, [viewMonth]); // Remove fetchCalendar and fetchPauseHistory from deps to avoid circular dependency

  const pausedSet = useMemo(() => new Set(data?.pausedDates ?? []), [data]);
  const modificationsByDate = data?.modificationsByDate ?? {};
  const statusByDate = data?.deliveryStatusByDate ?? {};

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Memoize getDayData to prevent excessive calculations
  const getDayData = useCallback((day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isPast = dStr < todayStr;
    const isToday = dStr === todayStr;
    const isPaused = pausedSet.has(dStr);
    const mod = modificationsByDate[dStr];
    const status = statusByDate[dStr];
    const isSelected = selectedDates.has(dStr);

    return { dStr, isPast, isToday, isPaused, mod, status, isSelected };
  }, [year, month, todayStr, pausedSet, modificationsByDate, statusByDate, selectedDates]);

  const getDayClassName = useCallback((day: number) => {
    const dayData = getDayData(day);
    const { isPast, isToday, isPaused, mod, isSelected, dStr } = dayData;
    const deliveryStatus = statusByDate[dStr];

    const base = 'aspect-square min-h-[50px] flex flex-col items-center justify-center rounded-xl font-bold transition-all border-2 relative overflow-hidden';
    let className = base;

    // Selection state takes priority in border
    if (isSelected) {
      className += ' border-green-500 ring-4 ring-green-500/20 scale-105 z-10';
    } else {
      className += ' border-transparent';
    }

    // Color based on status
    if (isToday) {
      className += ' bg-green-50 text-green-900 border-green-200';
    } else if (isPast) {
      if (deliveryStatus === 'DELIVERED') {
        className += ' bg-green-100 text-green-900 opacity-60';
      } else if (deliveryStatus === 'PAUSED' || isPaused) {
        className += ' bg-orange-100 text-orange-800 opacity-60';
      } else {
        className += ' bg-gray-50 text-gray-400 opacity-50';
      }
    } else if (isPaused) {
      className += ' bg-orange-100 text-orange-800 border-orange-200 shadow-sm';
    } else if (mod) {
      className += ' bg-blue-100 text-blue-800 border-blue-200 shadow-sm';
    } else {
      className += ' bg-white text-gray-700 border-gray-100 hover:border-green-200 hover:bg-green-50/50';
    }

    if (!isPast) className += ' cursor-pointer';
    return className;
  }, [getDayData, statusByDate]);

  const handleDayClick = (day: number) => {
    const { dStr, isPast } = getDayData(day);
    if (isPast) return;

    // Check if this is tomorrow and it's AFTER 5 PM (locked)
    // Business rule: Can pause until 5:00 PM, blocked after 5:00 PM
    const now = new Date();
    const currentHour = now.getHours();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if (currentHour >= 17 && dStr === tomorrowStr) {
      setError('Cannot modify tomorrow\'s delivery after 5 PM. You can make changes from day after tomorrow onwards.');
      return;
    }

    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dStr)) next.delete(dStr);
      else next.add(dStr);
      return next;
    });
  };

  const executePauseAction = async () => {
    setShowPauseConfirm(false);
    setSaving(true);
    try {
      const res = await fetchWithCsrf('/api/customer/calendar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: Array.from(selectedDates),
          action: 'pause'
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData.error?.includes('CSRF')) {
          clearCsrfToken();
          throw new Error('Invalid CSRF token. Please refresh the page and try again.');
        }
        throw new Error(errData.error || 'Failed to pause days');
      }

      setSelectedDates(new Set());
      await res.json();
      fetchCalendar(viewMonth.getFullYear(), viewMonth.getMonth(), true);
      fetchPauseHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pause failed');
    } finally {
      setSaving(false);
    }
  };

  const fetchPauseHistory = useCallback(() => {
    const controller = new AbortController();

    fetch(getApiUrl('/api/customer/pause-history'), {
      credentials: 'include',
      signal: controller.signal
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setPauseHistory(data))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setPauseHistory([]);
        }
      });

    return () => controller.abort();
  }, []);

  const undoPause = async (dateToUnpause: string) => {
    // Check if trying to undo tomorrow after 5 PM cutoff
    const now = new Date();
    const currentHour = now.getHours();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if (currentHour >= 17 && dateToUnpause === tomorrowStr) {
      setError('Cannot undo tomorrow\'s pause after 5 PM. You can make changes from day after tomorrow onwards.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithCsrf('/api/customer/calendar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: [dateToUnpause],
          action: 'resume'
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData.error?.includes('CSRF')) {
          clearCsrfToken();
          throw new Error('Invalid CSRF token. Please refresh the page and try again.');
        }
        throw new Error('Failed to unpause');
      }

      // Invalidate calendar cache for this month before refetching
      invalidateCalendarCache(viewMonth.getFullYear(), viewMonth.getMonth());
      fetchCalendar(viewMonth.getFullYear(), viewMonth.getMonth(), true);
      fetchPauseHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Undo failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAction = async (action: 'pause' | 'resume' | 'modify', quantityMl?: number) => {
    if (selectedDates.size === 0 || saving) return;

    // Check if any selected date is locked due to 5 PM cutoff
    // Business rule: Can modify until 5:00 PM, blocked at or after 5:00 PM
    const now = new Date();
    const currentHour = now.getHours();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if (currentHour >= 17 && selectedDates.has(tomorrowStr)) {
      const actionText = action === 'pause' ? 'pause' : action === 'resume' ? 'resume' : 'modify';
      setError(`Cannot ${actionText} tomorrow's delivery after 5 PM. You can make changes from day after tomorrow onwards.`);
      return;
    }

    if (action === 'pause') {
      // Show confirmation dialog before pausing
      setShowPauseConfirm(true);
      return;
    }

    setSaving(true);
    try {
      const largeBottles = quantityMl ? Math.floor(quantityMl / 1000) : 0;
      const smallBottles = quantityMl ? (quantityMl % 1000 >= 500 ? 1 : 0) : 0;

      const res = await fetchWithCsrf('/api/customer/calendar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: Array.from(selectedDates),
          action,
          quantityMl,
          largeBottles,
          smallBottles
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData.error?.includes('CSRF')) {
          clearCsrfToken();
          throw new Error('Invalid CSRF token. Please refresh the page and try again.');
        }
        throw new Error(errData.error || 'Failed to update plan');
      }

      // Success! Clear selection and reload content
      setSelectedDates(new Set());
      await res.json(); // Wait for sync confirm

      // Invalidate calendar cache for this month before refetching
      invalidateCalendarCache(year, month);
      fetchCalendar(year, month, true);

      // Show success message
      const actionText = action === 'pause' ? 'paused' : action === 'resume' ? 'reset' : 'updated';
      setSuccessMessage(`✓ ${selectedDates.size} day(s) ${actionText} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000); // Hide after 3 seconds
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const pauseDaysUsed = data?.pauseDaysUsed ?? 0;
  const baseQuantityMl = Number(data?.baseQuantityMl ?? 1000);
  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const quantityOptions = [500, 1000, 1500, 2000, 2500, 3000].filter(q => Number(q) !== baseQuantityMl);

  let singleDateInfo = null;
  if (selectedDates.size === 1) {
    const dStr = Array.from(selectedDates)[0];
    const isPaused = pausedSet.has(dStr);
    const mod = modificationsByDate[dStr];
    if (isPaused) {
      singleDateInfo = { status: 'PAUSED', color: 'text-orange-600', label: 'Delivery Paused' };
    } else if (mod) {
      const qtyLabel = mod.quantityMl >= 1000 ? (mod.quantityMl / 1000) + 'L' : mod.quantityMl + 'ml';
      singleDateInfo = { status: 'MODIFIED', color: 'text-blue-600', label: `Custom Quantity: ${qtyLabel}` };
    } else {
      singleDateInfo = { status: 'NORMAL', color: 'text-gray-500', label: 'Standard Subscription' };
    }
  }

  if (loading && !data) {
    return (
      <CustomerLayout>
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 animate-pulse font-medium">Syncing your delivery calendar...</p>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto pb-48">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Delivery Calendar</h1>
            <p className="text-gray-500 font-medium tracking-tight">Manage pauses and extra milk requests visually.</p>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 px-4 py-2 rounded-lg">
            <div className="bg-green-500 text-white p-1 rounded-full"><CheckCircle2 className="w-4 h-4" /></div>
            <span className="text-xs font-bold text-green-900 uppercase tracking-widest">Live Sync Enabled</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-100 rounded-lg p-4 mb-8 text-red-700 font-semibold flex items-center justify-between shadow-sm animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="tracking-tight">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border-2 border-green-100 rounded-lg p-4 mb-8 text-green-800 font-semibold flex items-center justify-between shadow-sm animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="tracking-tight">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-green-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="p-6 bg-amber-50/50 backdrop-blur-sm border-2 border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Cutoff Time</p>
                <p className="text-lg font-black text-amber-900">5:00 PM Daily</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 flex items-center gap-3 bg-blue-50/50 border-2 border-blue-100 hover:bg-blue-50 transition-colors">
            <div className="w-4 h-4 bg-blue-500 rounded-lg shadow-lg shadow-blue-500/30 flex-shrink-0" />
            <span className="text-xs font-black text-blue-800 uppercase tracking-widest leading-none">Modified Quantity</span>
          </Card>

          <Card className="p-6 flex items-center gap-3 bg-orange-50/50 border-2 border-orange-100 hover:bg-orange-50 transition-colors">
            <div className="w-4 h-4 bg-orange-500 rounded-lg shadow-lg shadow-orange-500/30 flex-shrink-0" />
            <span className="text-xs font-black text-orange-800 uppercase tracking-widest leading-none">Paused</span>
          </Card>
        </div>

        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-bold mb-1">Cutoff Time Rule:</p>
              <p>You can pause, resume, or modify <strong>tomorrow's delivery</strong> only if you do it <strong>before 5 PM today</strong>. At or after 5 PM, you can only make changes from day after tomorrow onwards.</p>
            </div>
          </div>
        </div>

        <Card className="p-10 border-2 border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden bg-white">
          {(refreshing || saving) && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <div className="bg-white shadow-sm px-6 py-4 rounded-lg flex items-center gap-4 border-2 border-green-100 animate-in zoom-in duration-300">
                <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
                <span className="text-base font-black text-green-900 tracking-tight uppercase tracking-widest">Updating Calendar...</span>
              </div>
            </div>
          )}

          <div className="absolute top-0 left-0 w-full h-1 bg-green-800 opacity-30" />

          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{monthLabel}</h2>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                className="flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 hover:bg-green-50 hover:border-green-200 h-11 w-11 transition-all shadow-sm "
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                className="flex items-center justify-center rounded-xl bg-white border-2 border-gray-100 hover:bg-green-50 hover:border-green-200 h-11 w-11 transition-all shadow-sm "
              >
                <ChevronRight className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3 mb-4 text-center text-xs font-black text-gray-400 uppercase tracking-widest opacity-80">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="pb-4">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const { isPaused, mod, isSelected, isToday } = getDayData(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={getDayClassName(day)}
                  onClick={() => handleDayClick(day)}
                  disabled={saving}
                >
                  <span className={`relative z-10 transition-transform ${isSelected ? 'scale-110' : ''}`}>{day}</span>
                  {isToday && <span className="absolute top-1 text-[8px] font-black text-green-800 uppercase tracking-tighter opacity-70">Today</span>}

                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    </div>
                  )}
                  {mod && !isPaused && (
                    <div className="absolute bottom-2 w-full flex justify-center">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    </div>
                  )}
                  {isPaused && (
                    <div className="absolute bottom-2 w-full flex justify-center">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Pause History Section */}
        {pauseHistory.length > 0 && (
          <Card className="mt-8 p-6 border-2 border-orange-100 bg-orange-50/30">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-orange-600" />
              Recent Pauses (Last 7 Days)
            </h3>
            <div className="space-y-2">
              {pauseHistory.slice(0, 10).map((item) => {
                const date = new Date(item.date);
                const pausedAt = new Date(item.pausedAt);
                const dateStr = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = pausedAt.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const canUndo = new Date(item.date) >= new Date(todayStr);

                return (
                  <div key={item.date} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                    <div>
                      <p className="font-semibold text-gray-900">{dateStr}</p>
                      <p className="text-xs text-gray-500">Paused on {timeStr}</p>
                    </div>
                    {canUndo && (
                      <Button
                        onClick={() => undoPause(item.date)}
                        disabled={saving}
                        className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-4 py-2"
                      >
                        Undo Pause
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Pause Confirmation Dialog */}
      {showPauseConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full mx-4 animate-in zoom-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Confirm Pause</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to pause delivery for <strong>{selectedDates.size}</strong> {selectedDates.size === 1 ? 'day' : 'days'}?
              You can undo this action from the pause history below if needed.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={executePauseAction}
                disabled={saving}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                {saving ? 'Pausing...' : 'Yes, Pause'}
              </Button>
              <Button
                onClick={() => setShowPauseConfirm(false)}
                disabled={saving}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Premium Bulk Action Bar */}
      {selectedDates.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-[100] animate-in fade-in slide-in-from-bottom-12 duration-700 ease-out">
          <div className="bg-gray-950/95 backdrop-blur-xl border border-white/10 text-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] p-6 ring-1 ring-white/20">
            <div className="flex flex-col gap-6">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-green-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] p-3 rounded-lg">
                    <CalendarIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-lg font-black tracking-tight">{selectedDates.size} {selectedDates.size === 1 ? 'Date' : 'Dates'} Selected</h4>
                    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${singleDateInfo?.color || 'text-green-600'}`}>
                      {singleDateInfo ? (
                        <>
                          <div className={`w-1.5 h-1.5 rounded-full bg-current`} />
                          {singleDateInfo.label}
                        </>
                      ) : (
                        <span className="text-gray-200">Choose action for selection</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDates(new Set())}
                  className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all hover:rotate-90 duration-300"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">

                <div className="w-full md:w-auto grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleBulkAction('pause')}
                    className="h-12 border-none font-black text-xs uppercase tracking-widest rounded-lg shadow-xl transition-all bg-orange-600 hover:bg-orange-500 shadow-orange-900/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Pause'
                    )}
                  </Button>

                  <Button
                    onClick={() => handleBulkAction('resume')}
                    className="h-12 border-2 border-white/10 hover:bg-white/5 bg-transparent text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Reset'
                    )}
                  </Button>
                </div>

                <div className="hidden md:block w-px h-10 bg-white/10" />

                <div className="w-full flex-1 space-y-3">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] block text-center md:text-left">Assign Quantity Override</span>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1.5 border border-white/10 ring-1 ring-white/5 overflow-x-auto pb-1 md:pb-1.5 no-scrollbar">
                    {quantityOptions.map(ml => (
                      <button
                        key={ml}
                        onClick={() => handleBulkAction('modify', ml)}
                        disabled={saving}
                        className="min-w-[75px] flex-1 py-2.5 rounded-xl text-xs font-black hover:bg-green-500 transition-all  bg-white/10 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        {saving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-2 pt-2 border-t border-white/5 opacity-50">
                <Info className="w-3.5 h-3.5 text-gray-200" />
                <p className="text-[10px] font-bold text-gray-200 uppercase tracking-widest italic leading-tight">These changes update the delivery person's app in real-time.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};
