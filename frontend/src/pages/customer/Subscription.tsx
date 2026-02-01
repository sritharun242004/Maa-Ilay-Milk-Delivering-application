import React, { useState } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ChevronDown, ArrowRight, Calendar } from 'lucide-react';
import { PRICING, DAILY_QUANTITY_OPTIONS } from '../../config/pricing';
import { getLocalTomorrowISO } from '../../lib/date';

type QuantityOption = (typeof DAILY_QUANTITY_OPTIONS)[number];

function parseDate(s: string): Date {
  const d = new Date(s);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1);
}

export const Subscription: React.FC = () => {
  const [dailyQuantity, setDailyQuantity] = useState<QuantityOption | null>(null);
  const [showDateRange, setShowDateRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  const tomorrow = getLocalTomorrowISO();

  const minToDate = fromDate || tomorrow;
  const days = fromDate && toDate ? daysBetween(fromDate, toDate) : 0;
  const dailyRs = dailyQuantity?.dailyRs ?? 0;
  const milkAmountRs = days * dailyRs;
  const depositRs = 0;
  const totalRs = milkAmountRs + depositRs;

  const handleStartSubscribe = () => {
    if (!dailyQuantity) return;
    setShowDateRange(true);
    if (!fromDate) setFromDate(tomorrow);
  };

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Subscription</h1>
          <p className="text-gray-600">Choose daily quantity and subscription period</p>
        </div>

        <Card variant="gradient" className="p-8 mb-8 border-2 border-emerald-200">
          <Badge variant="success" className="mb-4">
            Current Plan
          </Badge>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Daily Quantity</p>
              <p className="text-2xl font-bold text-gray-900">1L per day</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Daily Cost</p>
              <p className="text-2xl font-bold text-emerald-600">₹110/day</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <Badge variant="success">Active</Badge>
            </div>
          </div>
          <Button variant="secondary" className="mt-6">
            Modify Plan
          </Button>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Daily Quantity</h2>
          <p className="text-gray-600 mb-6">Select how many liters you want per day (0.5L to 4L)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {DAILY_QUANTITY_OPTIONS.map((opt) => (
              <button
                key={opt.liters}
                type="button"
                onClick={() => setDailyQuantity(opt)}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  dailyQuantity?.liters === opt.liters
                    ? 'border-emerald-500 bg-emerald-50 shadow-md'
                    : 'border-gray-200 hover:border-emerald-300 bg-white'
                }`}
              >
                <p className="text-2xl font-bold text-gray-900">{opt.label}</p>
                <p className="text-lg font-semibold text-emerald-600 mt-1">₹{opt.dailyRs}/day</p>
              </button>
            ))}
          </div>
        </Card>

        <div className="flex gap-4 mb-8">
          <Button
            icon={ArrowRight}
            onClick={handleStartSubscribe}
            disabled={!dailyQuantity}
          >
            Start Subscribe
          </Button>
          <Button variant="secondary">Cancel</Button>
        </div>

        {showDateRange && dailyQuantity && (
          <Card className="p-8 mb-8 border-l-4 border-emerald-500">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-emerald-600" />
              Select subscription period
            </h3>
            <p className="text-gray-600 mb-6">
              Choose from date and to date. Example: from 30 Jan to 29 Feb. Payment is calculated for the number of days in this range.
            </p>
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From date</label>
                <input
                  type="date"
                  value={fromDate}
                  min={tomorrow}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To date</label>
                <input
                  type="date"
                  value={toDate}
                  min={minToDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              </div>
            </div>
            {fromDate && toDate && days > 0 && (
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Payment summary (all in ₹)</h4>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex justify-between">
                    <span>{days} days × ₹{dailyQuantity.dailyRs}/day</span>
                    <span>₹{milkAmountRs.toLocaleString('en-IN')}</span>
                  </li>
                  {depositRs > 0 && (
                    <li className="flex justify-between">
                      <span>Bottle deposit (if first time)</span>
                      <span>₹{depositRs.toLocaleString('en-IN')}</span>
                    </li>
                  )}
                  <li className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total to pay</span>
                    <span>₹{totalRs.toLocaleString('en-IN')}</span>
                  </li>
                </ul>
                <Button className="mt-6 w-full sm:w-auto" icon={ArrowRight}>
                  Pay ₹{totalRs.toLocaleString('en-IN')} & start subscription
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 mb-8 border-l-4 border-emerald-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment schedule</h3>
          <p className="text-sm text-gray-600 mb-2">Payment date is the <strong>5th of every month</strong>. Amount is calculated for the days in your selected period; after that, renew before 5th for the next month.</p>
        </Card>

        <Card className="mb-8 overflow-hidden">
          <button
            onClick={() => setRulesOpen(!rulesOpen)}
            className="w-full p-6 flex items-center justify-between bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <span className="font-semibold text-gray-900">Subscription Rules</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${rulesOpen ? 'rotate-180' : ''}`} />
          </button>
          {rulesOpen && (
            <div className="px-6 pb-6 pt-4">
              <ul className="space-y-3 text-gray-700">
                <li>• Daily delivery by 6 AM</li>
                <li>• Cutoff time for changes: 5 PM previous day</li>
                <li>• Maximum 4 liters per day</li>
                <li>• Pause up to 5 days per month</li>
                <li>• Bottle deposit charged every 90 days when applicable</li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </CustomerLayout>
  );
};
