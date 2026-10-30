import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import {
  listUsers,
  personName,
  userStatusLabels,
} from '../features/management/api';
import { Pager } from '../features/management/ui';
import { formatPersianDate } from '../lib/locale';
import '../features/management/management.css';

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = search.trim();

  const query = useQuery({
    queryKey: ['customers', term, page],
    queryFn: () =>
      listUsers({
        role: 'CUSTOMER',
        search: term || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>مشتریان</h1>
          <p>فهرست مشتری‌های آرایشگاه</p>
        </div>
      </div>

      <section className="mgmt-toolbar">
        <input
          className="mgmt-search"
          type="search"
          placeholder="جستجو با نام یا شماره موبایل"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </section>

      {query.isPending ? (
        <div className="data-state">
          <span className="spinner" />
          <p>در حال دریافت مشتری‌ها…</p>
        </div>
      ) : null}
      {query.isError ? (
        <div className="data-state error-state">
          <p>دریافت مشتری‌ها انجام نشد.</p>
          <button type="button" onClick={() => void query.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : null}
      {query.isSuccess && items.length === 0 ? (
        <div className="data-state">
          <UserRound />
          <p>مشتری‌ای پیدا نشد.</p>
        </div>
      ) : null}

      {items.length ? (
        <section className="mgmt-panel">
          {items.map((user) => (
            <div className="mgmt-user-row" key={user.id}>
              <div>
                <strong>{personName(user)}</strong>
                <span dir="ltr">{user.phone}</span>
              </div>
              <div>
                <span>{userStatusLabels[user.status] ?? user.status}</span>
                <span>عضویت: {formatPersianDate(user.createdAt)}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {query.data ? (
        <Pager
          page={page}
          totalPages={query.data.meta.totalPages}
          onChange={setPage}
        />
      ) : null}
    </>
  );
}
