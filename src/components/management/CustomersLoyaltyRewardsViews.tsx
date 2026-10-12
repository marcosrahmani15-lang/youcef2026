import React, { useState } from 'react';
import {
  Users,
  Search,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { formatAlgiersDate, formatAlgiersDateTime } from '../../utils/algiersTime';

// ============================================================================
// SECTION: CUSTOMERS MANAGEMENT VIEW (ADMIN ONLY)
// ============================================================================
export const CustomersManagementView: React.FC<{
  customers: any[];
  onSearch: (q: string, statusFilter?: string) => void;
  onUpdateCustomer: (
    customerId: string,
    updates: {
      accountStatus?: 'Active' | 'Suspended';
    },
  ) => Promise<void>;
}> = ({ customers, onSearch, onUpdateCustomer }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedCustomer = selectedCustomerId
    ? customers.find((c) => c.customerId === selectedCustomerId) || null
    : null;

  const filteredCustomers = customers.filter((c) => {
    if (statusFilter === 'ALL') return true;
    const accSt = (c.accountStatus || 'Active').toUpperCase();
    return accSt === statusFilter;
  });

  // Detailed Customer Profile View
  if (selectedCustomer) {
    const orders = selectedCustomer.orders || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedCustomerId(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#ded7c8] hover:border-[#351016] text-xs font-semibold text-[#351016] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Customers</span>
          </button>
          <span className="text-xs font-mono text-[#7a6b61]">
            Sanitized Customer Profile
          </span>
        </div>

        {/* CUSTOMER PROFILE SUMMARY */}
        <div className="bg-white border border-[#ded7c8] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#eee9de] pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#c9833a] font-bold block">
                CUSTOMER PROFILE · {selectedCustomer.customerId}
              </span>
              <h3 className="font-serif font-bold text-2xl text-[#221a14] mt-1">
                {selectedCustomer.name}
              </h3>
              <p className="font-mono text-xs text-[#59493f] mt-1">
                Phone: <strong>{selectedCustomer.phone}</strong>
                {selectedCustomer.email ? ` · Email: ${selectedCustomer.email}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedCustomer.accountStatus === 'Suspended'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-[#2e7d32]/15 text-[#2e7d32]'
                }`}
              >
                {selectedCustomer.accountStatus || 'Active'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#faf6ef] border border-[#ded7c8]">
              <span className="text-[#7a6b61] block">Registration Date</span>
              <strong className="font-mono text-sm text-[#221a14] mt-0.5 block">
                {selectedCustomer.createdAt
                  ? formatAlgiersDate(selectedCustomer.createdAt)
                  : '—'}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-[#faf6ef] border border-[#ded7c8]">
              <span className="text-[#7a6b61] block">Account Status</span>
              <strong className="font-mono text-sm text-[#221a14] mt-0.5 block">
                {selectedCustomer.accountStatus || 'Active'}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-[#faf6ef] border border-[#ded7c8]">
              <span className="text-[#7a6b61] block">Total Orders</span>
              <strong className="font-mono text-sm text-[#221a14] mt-0.5 block">
                {selectedCustomer.totalOrders || 0} orders
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-[#faf6ef] border border-[#ded7c8]">
              <span className="text-[#7a6b61] block">Total Spent</span>
              <strong className="font-mono text-sm text-[#351016] mt-0.5 block">
                {(selectedCustomer.totalSpent || 0).toLocaleString()} DA
              </strong>
            </div>
          </div>

          {/* Admin Controls for Account Status */}
          <div className="pt-2 border-t border-[#eee9de] max-w-xs">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#59493f] mb-1.5">
              Account Status
            </label>
            <select
              disabled={busyId === selectedCustomer.customerId}
              value={selectedCustomer.accountStatus || 'Active'}
              onChange={async (e) => {
                setBusyId(selectedCustomer.customerId);
                try {
                  await onUpdateCustomer(selectedCustomer.customerId, {
                    accountStatus: e.target.value as 'Active' | 'Suspended',
                  });
                } finally {
                  setBusyId(null);
                }
              }}
              className="w-full px-3.5 py-2.5 bg-[#faf6ef] border border-[#ded7c8] rounded-xl text-xs font-semibold"
            >
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* CUSTOMER ORDERS TABLE */}
        <div className="bg-white border border-[#ded7c8] rounded-2xl overflow-hidden">
          <div className="border-b border-[#ded7c8] bg-[#faf6ef] px-5 py-3">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-[#351016]">
              Customer Orders ({orders.length})
            </h4>
          </div>

          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#ded7c8] uppercase tracking-wider text-[#7a6b61]">
                    <th className="py-3 px-3">Order</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Total</th>
                    <th className="py-3 px-3">Date & Time (Algiers)</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee9de]">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#8a7b70]">
                        No order history recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord: any) => (
                      <tr key={ord.orderId || ord.id} className="hover:bg-[#faf6ef]/60">
                        <td className="py-3 px-3 font-mono font-bold text-[#351016]">
                          #{ord.orderId || ord.id}
                        </td>
                        <td className="py-3 px-3 text-[#221a14]">
                          {(ord.orderItems || ord.items || [])
                            .map((i: any) => `${i.name} ×${i.quantity}`)
                            .join(', ')}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#221a14]">
                          {(ord.totalAmount || 0).toLocaleString()} DA
                        </td>
                        <td className="py-3 px-3 font-mono text-[#6b5a4e]">
                          {ord.algiersDateTime || formatAlgiersDateTime(ord.createdAt)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#351016]">
                          {ord.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Customers Directory Table View
  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-[#ded7c8] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8a7b70] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearch(e.target.value, statusFilter);
            }}
            placeholder="Search customer by name, phone, or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#faf6ef] border border-[#ded7c8] rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#faf6ef] border border-[#ded7c8] rounded-xl px-3 py-2">
            <Filter className="w-3.5 h-3.5 text-[#7a6b61]" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                onSearch(search, e.target.value);
              }}
              aria-label="Filter customers"
              className="bg-transparent text-xs font-semibold text-[#221a14] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Customers ({customers.length})</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="SUSPENDED">Suspended Accounts</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-[#ded7c8] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#faf6ef] border-b border-[#ded7c8] text-[11px] uppercase tracking-wider text-[#7a6b61]">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Orders</th>
                <th className="py-3.5 px-4">Total Spent</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee9de]">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#8a7b70]">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr
                    key={c.customerId}
                    onClick={() => {
                      setSelectedCustomerId(c.customerId);
                    }}
                    className="cursor-pointer hover:bg-[#faf6ef]/80 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-serif font-bold text-[#221a14]">{c.name}</div>
                      <div className="font-mono text-[11px] text-[#8a7b70]">{c.customerId}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#351016]">{c.phone}</td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#221a14]">
                      {c.totalOrders || 0}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#351016]">
                      {(c.totalSpent || 0).toLocaleString()} DA
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#6b5a4e]">
                      {c.createdAt ? formatAlgiersDate(c.createdAt) : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded ${
                          c.accountStatus === 'Suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-[#2e7d32]/15 text-[#2e7d32]'
                        }`}
                      >
                        {c.accountStatus || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
