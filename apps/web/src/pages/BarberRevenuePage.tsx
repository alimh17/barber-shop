import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { getMyRevenue } from '../features/reports/api';
import { formatToman } from '../features/management/api';
import { formatPersianDate } from '../lib/locale';
import '../features/management/management.css';

type Period = 'day' | 'week' | 'month';
const periods: Array<{ value: Period; label: string }> = [
  { value: 'day', label: 'روزانه' },
  { value: 'week', label: 'هفتگی' },
  { value: 'month', label: 'ماهانه' },
];

export function BarberRevenuePage() {
  const [period, setPeriod] = useState<Period>('week');
  const report = useQuery({
    queryKey: ['my-revenue', period],
    queryFn: () => getMyRevenue(period),
  });
  const buckets = report.data?.buckets ?? [];
  const options: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit' },
    stroke: { curve: 'smooth', width: 3 },
    dataLabels: { enabled: false },
    xaxis: {
      categories: buckets.map((item) => period === 'day' ? `${item.key}:00` : formatPersianDate(item.key)),
      labels: { rotate: period === 'month' ? -45 : 0, hideOverlappingLabels: true },
    },
    yaxis: { labels: { formatter: (value) => Math.round(value).toLocaleString('fa-IR') } },
    tooltip: { y: { formatter: (value) => value == null ? '—' : formatToman(value) } },
    noData: { text: 'داده‌ای برای نمایش وجود ندارد' },
  };
  return (
    <div className="revenue-page">
      <div className="page-title revenue-title">
        <div>
          <h1>درآمد من</h1>
          <p>درآمد حاصل از نوبت‌های تکمیل‌شده شما</p>
        </div>
      </div>
      <section className="revenue-filters">
        <div className="mgmt-chips" aria-label="بازه گزارش">
          {periods.map((item) => (
            <button key={item.value} type="button"
              className={`chip ${period === item.value ? 'active' : ''}`}
              onClick={() => setPeriod(item.value)}>{item.label}</button>
          ))}
        </div>
      </section>
      {report.isPending && <div className="data-state"><span className="spinner" /><p>در حال دریافت گزارش...</p></div>}
      {report.isError && <div className="data-state error-state"><p>دریافت گزارش درآمد ناموفق بود.</p></div>}
      {report.data && (
        <>
          <section className="revenue-stats">
            <article><div><p>مجموع درآمد</p><strong>{formatToman(report.data.totalRevenue)}</strong></div></article>
            <article><div><p>نوبت‌های تکمیل‌شده</p><strong>{report.data.appointmentCount.toLocaleString('fa-IR')}</strong></div></article>
          </section>
          <section className="revenue-panel">
            <header><div><h2>روند درآمد {periods.find((item) => item.value === period)?.label}</h2>
              <p>مبالغ بر اساس قیمت ثبت‌شده نوبت‌ها محاسبه شده‌اند.</p></div></header>
            <Chart type="area" height={340} options={options}
              series={[{ name: 'درآمد', data: buckets.map((item) => item.revenue) }]} />
          </section>
        </>
      )}
    </div>
  );
}
