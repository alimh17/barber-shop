import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../auth/api';
import { getSalons } from '../features/salons/api';
import { createWalkInCustomer } from '../features/management/api';
import {
  listUsers,
  personName,
  userStatusLabels,
} from '../features/management/api';
import { Pager } from '../features/management/ui';
import { formatPersianDate } from '../lib/locale';
import '../features/management/management.css';
import './services-page.css';

export function CustomersPage() {
  const client = useQueryClient();
  const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons });
  const [selectedSalon, setSelectedSalon] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const createCustomer = useMutation({ mutationFn: () => createWalkInCustomer({ salonId: selectedSalon || salons.data?.[0]?.id || '', name: newName.trim() || undefined, phone: newPhone.trim() || undefined }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['customers'] }); setShowCreate(false); setNewName(''); setNewPhone(''); toast.success('\u0645\u0634\u062a\u0631\u06cc \u062b\u0628\u062a \u0634\u062f'); }, onError: error => toast.error(getApiErrorMessage(error, '\u0646\u0627\u0645 \u0645\u0634\u062a\u0631\u06cc ?????? ???')) });
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

      <button type="button" className="primary-button" onClick={() => setShowCreate(value => !value)}>{'\u062b\u0628\u062a \u0645\u0634\u062a\u0631\u06cc \u062c\u062f\u06cc\u062f'}</button>
      {showCreate && <form className="services-card" style={{ marginTop: 16 }} onSubmit={event => { event.preventDefault(); createCustomer.mutate(); }}>
        <h2>{'\u0645\u0634\u062a\u0631\u06cc \u062c\u062f\u06cc\u062f'}</h2>
        {(salons.data?.length ?? 0) > 1 && <label className="services-field">{'\u0633\u0627\u0644\u0646'}<select value={selectedSalon || salons.data?.[0]?.id} onChange={event => setSelectedSalon(event.target.value)}>{salons.data?.map(salon => <option key={salon.id} value={salon.id}>{salon.name}</option>)}</select></label>}
        <label className="services-field">{'\u0646\u0627\u0645'}<input value={newName} onChange={event => setNewName(event.target.value)} /></label>
        <label className="services-field">{'\u0645\u0648\u0628\u0627\u06cc\u0644'}<input dir="ltr" value={newPhone} onChange={event => setNewPhone(event.target.value)} placeholder="09123456789" /></label>
        <p>{'\u0648\u0627\u0631\u062f \u06a9\u0631\u062f\u0646 \u0646\u0627\u0645 \u06cc\u0627 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06cc\u0644 \u06a9\u0627\u0641\u06cc \u0627\u0633\u062a.'}</p>
        <button type="submit" className="primary-button" disabled={createCustomer.isPending || !salons.data?.length || (!newName.trim() && !newPhone.trim())}>{createCustomer.isPending ? '\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a...' : '??\u0646\u0627\u0645 \u0645\u0634\u062a\u0631\u06cc'}</button>
      </form>}
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
