import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Scissors,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getApiErrorMessage } from '../auth/api';
import { formatToman } from '../features/management/api';
import { formatPersianDate, formatPersianMonth } from '../lib/locale';
import {
  downloadRevenueReport,
  getRevenueReport,
} from '../features/reports/api';
import { getSalons } from '../features/salons/api';
import '../features/management/management.css';

type PeriodMode = 'month' | 'year';

function currentLocalMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .replace('/', '-');
}

function periodBounds(mode: PeriodMode, month: string, year: string) {
  if (mode === 'year') {
    const parsedYear = Number(year);
    return {
      from: `${parsedYear}-01-01`,
      to: `${parsedYear + 1}-01-01`,
    };
  }
  const [parsedYear, parsedMonth] = month.split('-').map(Number);
  const next = new Date(Date.UTC(parsedYear, parsedMonth, 1));
  return {
    from: `${month}-01`,
    to: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`,
  };
}

function persianPeriodLabel(from: string, to: string) {
  const lastDay = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(lastDay.getTime())) return '—';
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return `${formatPersianDate(from)} تا ${formatPersianDate(lastDay)}`;
}

const toFa = (value: number) => value.toLocaleString('fa-IR');
const initialMonth = currentLocalMonth();

export function RevenueReportPage() {
  const [mode, setMode] = useState<PeriodMode>('month');
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialMonth.slice(0, 4));
  const [salonId, setSalonId] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons });
  const selectedSalonId = salonId || salons.data?.[0]?.id || '';
  const bounds = periodBounds(mode, month, year);
  const report = useQuery({
    queryKey: ['revenue-report', selectedSalonId, bounds.from, bounds.to, page],
    queryFn: () =>
      getRevenueReport({
        salonId: selectedSalonId,
        ...bounds,
        page,
        limit: 25,
      }),
    enabled: Boolean(selectedSalonId),
  });
  const maxRevenue = Math.max(
    1,
    ...(report.data?.byMonth.map((item) => item.revenue) ?? [0]),
  );

  const exportExcel = async () => {
    if (!selectedSalonId || exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await downloadRevenueReport({
        salonId: selectedSalonId,
        ...bounds,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('فایل اکسل گزارش آماده شد');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'ساخت خروجی اکسل انجام نشد'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="revenue-page">
      <div className="page-title revenue-title">
        <div>
          <h1>گزارش درآمد</h1>
          <p>
            درآمد فقط از نوبت‌های تکمیل‌شده و بر اساس مبلغ ثبت‌شده همان نوبت
            محاسبه می‌شود.
          </p>
        </div>
        <button
          className="mgmt-primary-link"
          type="button"
          onClick={() => void exportExcel()}
          disabled={!report.data || exporting}
        >
          <Download size={18} />
          {exporting ? 'در حال ساخت…' : 'خروجی Excel'}
        </button>
      </div>

      <section className="revenue-filters">
        <label>
          <span>سالن</span>
          <select
            value={selectedSalonId}
            onChange={(event) => {
              setSalonId(event.target.value);
              setPage(1);
            }}
          >
            {salons.data?.map((salon) => (
              <option key={salon.id} value={salon.id}>
                {salon.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mgmt-chips" aria-label="نوع بازه">
          <button
            className={`chip ${mode === 'month' ? 'active' : ''}`}
            type="button"
            onClick={() => {
              setMode('month');
              setPage(1);
            }}
          >
            ماهانه
          </button>
          <button
            className={`chip ${mode === 'year' ? 'active' : ''}`}
            type="button"
            onClick={() => {
              setMode('year');
              setPage(1);
            }}
          >
            سالانه
          </button>
        </div>
        {mode === 'month' ? (
          <label>
            <span>ماه</span>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(1);
              }}
            />
          </label>
        ) : (
          <label>
            <span>سال</span>
            <input
              type="number"
              min="2000"
              max="2200"
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setPage(1);
              }}
            />
          </label>
        )}
      </section>
      <p className="inline-note">
        بازه شمسی: {persianPeriodLabel(bounds.from, bounds.to)}
      </p>

      {report.isPending ? (
        <div className="data-state">
          <span className="spinner" />
          <p>در حال محاسبه درآمد…</p>
        </div>
      ) : null}
      {report.isError ? (
        <div className="data-state error-state">
          <p>دریافت گزارش درآمد انجام نشد.</p>
        </div>
      ) : null}

      {report.data ? (
        <>
          <section className="revenue-stats">
            <article>
              <span>
                <Banknote />
              </span>
              <div>
                <p>درآمد کل</p>
                <strong>{formatToman(report.data.totalRevenue)}</strong>
              </div>
            </article>
            <article>
              <span>
                <CalendarRange />
              </span>
              <div>
                <p>نوبت تکمیل‌شده</p>
                <strong>{toFa(report.data.appointmentCount)}</strong>
              </div>
            </article>
            <article>
              <span>
                <FileSpreadsheet />
              </span>
              <div>
                <p>میانگین هر نوبت</p>
                <strong>
                  {formatToman(report.data.averageAppointmentRevenue)}
                </strong>
              </div>
            </article>
          </section>

          {mode === 'year' ? (
            <section className="revenue-panel">
              <header>
                <div>
                  <h2>روند ماهانه</h2>
                  <p>مقایسه درآمد ماه‌های سال انتخاب‌شده</p>
                </div>
              </header>
              <div className="revenue-bars">
                {report.data.byMonth.map((item) => (
                  <div key={item.month}>
                    <span>{formatPersianMonth(item.month)}</span>
                    <div>
                      <i
                        style={{
                          width: `${(item.revenue / maxRevenue) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{formatToman(item.revenue)}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="revenue-panel">
            <header>
              <div>
                <h2>درآمد ایجادشده توسط آرایشگرها</h2>
                <p>
                  آرایشگرهای بدون درآمد نیز برای کنترل کامل نمایش داده می‌شوند.
                </p>
              </div>
              <Scissors />
            </header>
            <div className="revenue-table-wrap">
              <table className="revenue-table">
                <thead>
                  <tr>
                    <th>آرایشگر</th>
                    <th>وضعیت</th>
                    <th>نوبت تکمیل‌شده</th>
                    <th>درآمد ایجادشده</th>
                    <th>سهم از کل</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.byBarber.map((barber) => (
                    <tr key={barber.barberId}>
                      <td>
                        <strong>{barber.barberName}</strong>
                        <small>{barber.phone}</small>
                      </td>
                      <td>{barber.isActive ? 'فعال' : 'غیرفعال'}</td>
                      <td>{toFa(barber.appointmentCount)}</td>
                      <td>{formatToman(barber.revenue)}</td>
                      <td>
                        {report.data.totalRevenue
                          ? `${((barber.revenue / report.data.totalRevenue) * 100).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`
                          : '۰٪'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="revenue-panel">
            <header>
              <div>
                <h2>ریز درآمدها</h2>
                <p>هر ردیف یک نوبت تکمیل‌شده است.</p>
              </div>
            </header>
            <div className="revenue-table-wrap">
              <table className="revenue-table detail">
                <thead>
                  <tr>
                    <th>تاریخ</th>
                    <th>آرایشگر</th>
                    <th>مشتری</th>
                    <th>خدمت</th>
                    <th>مبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.details.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {formatPersianDate(item.date)}
                        <small>{item.time}</small>
                      </td>
                      <td>{item.barberName}</td>
                      <td>
                        {item.customerName}
                        <small>{item.customerPhone}</small>
                      </td>
                      <td>{item.serviceName}</td>
                      <td>{formatToman(item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.data.details.items.length === 0 ? (
                <div className="data-state">
                  <p>در این بازه درآمد تکمیل‌شده‌ای ثبت نشده است.</p>
                </div>
              ) : null}
            </div>
            <div className="mgmt-pager">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                قبلی
              </button>
              <span>
                صفحه {toFa(page)} از {toFa(report.data.details.meta.totalPages)}
              </span>
              <button
                type="button"
                disabled={page >= report.data.details.meta.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                بعدی
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
