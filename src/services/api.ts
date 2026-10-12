import { CustomerAccount, CustomerProfile } from '../types/customer';
import {
  PastOrder,
  CartItem,
  OrderCompletedEventPayload,
  AdminOrdersDashboardMetrics,
} from '../types/coffee';
import { getAllOfficialProducts } from '../data/officialMenuData';
import { TodaySpecialItem } from '../types/specials';
import { DailyQuiz, QuizAttempt, QuizLeaderboardData } from '../types/quiz';
import { WeeklyCompetition } from '../types/competitions';

const ORDERS_API_BASE = '/api/orders';
const CUSTOMER_API_BASE = '/api/customer';
const MANAGEMENT_API_BASE = '/api/management';

// Session Token Storage Keys
const CUSTOMER_TOKEN_KEY = 'venty_auth_customer_token';
const STAFF_TOKEN_KEY = 'venty_auth_staff_token';
const ADMIN_TOKEN_KEY = 'venty_auth_admin_token';
const DEVICE_ID_KEY = 'venty_auth_device_id';

export const getClientDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let devId = localStorage.getItem(DEVICE_ID_KEY);
  if (!devId) {
    devId = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, devId);
  }
  return devId;
};

const OPAQUE_SESSION_TOKEN_PATTERN = /^vty_sess_[0-9a-f]{32,128}$/;

const memoryManagementSessionTokens: {
  ADMIN: string | null;
  STAFF: string | null;
} = {
  ADMIN: null,
  STAFF: null,
};

export const getSessionToken = (role: 'CUSTOMER' | 'STAFF' | 'ADMIN'): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (role === 'ADMIN') {
      if (memoryManagementSessionTokens.ADMIN) return memoryManagementSessionTokens.ADMIN;
      const stored = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      return stored && OPAQUE_SESSION_TOKEN_PATTERN.test(stored) ? stored : null;
    }
    if (role === 'STAFF') {
      if (memoryManagementSessionTokens.STAFF) return memoryManagementSessionTokens.STAFF;
      const stored = sessionStorage.getItem(STAFF_TOKEN_KEY);
      return stored && OPAQUE_SESSION_TOKEN_PATTERN.test(stored) ? stored : null;
    }
    return localStorage.getItem(CUSTOMER_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setSessionToken = (
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN',
  token: string,
): void => {
  if (typeof window === 'undefined') return;
  try {
    if (role === 'ADMIN') {
      memoryManagementSessionTokens.ADMIN = token;
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else if (role === 'STAFF') {
      memoryManagementSessionTokens.STAFF = token;
      sessionStorage.setItem(STAFF_TOKEN_KEY, token);
    } else {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    }
  } catch {
    // Storage quota or private browsing mode handling
  }
};

export const clearSessionToken = (role?: 'CUSTOMER' | 'STAFF' | 'ADMIN'): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!role || role === 'CUSTOMER') {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    }
    if (!role || role === 'STAFF') {
      memoryManagementSessionTokens.STAFF = null;
      sessionStorage.removeItem(STAFF_TOKEN_KEY);
    }
    if (!role || role === 'ADMIN') {
      memoryManagementSessionTokens.ADMIN = null;
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
};

export const getStaffSessionToken = (): string | null => getSessionToken('STAFF');
export const getAdminSessionToken = (): string | null => getSessionToken('ADMIN');
export const clearStaffSessionToken = (): void => clearSessionToken('STAFF');
export const clearAdminSessionToken = (): void => clearSessionToken('ADMIN');

const getAuthHeaders = (role?: 'CUSTOMER' | 'STAFF' | 'ADMIN'): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Device': getClientDeviceId(),
  };
  const token = role ? getSessionToken(role) : getSessionToken('CUSTOMER');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ============================================================================
// CUSTOMER AUTH & SESSIONS
// ============================================================================

export const requestCustomerOtpOnBackend = async (params: {
  phone: string;
  name?: string;
  email?: string;
  favouriteDrink?: string;
  purpose?: 'LOGIN' | 'SIGNUP' | 'VERIFY';
}): Promise<{ success: boolean; message: string; simulatedCode?: string }> => {
  const res = await fetch(`${CUSTOMER_API_BASE}/otp/request`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to request OTP');
  }
  return data;
};

export const verifyCustomerOtpOnBackend = async (params: {
  phone: string;
  code: string;
  name?: string;
  email?: string;
  favouriteDrink?: string;
}): Promise<{
  success: boolean;
  token?: string;
  account?: CustomerAccount;
  orders?: PastOrder[];
  created?: boolean;
  message?: string;
}> => {
  const res = await fetch(`${CUSTOMER_API_BASE}/otp/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'OTP verification failed');
  }
  if (data.token) {
    setSessionToken('CUSTOMER', data.token);
  }
  return data;
};

export const fetchCustomerProfileFromBackend = async (
  customerId?: string,
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' = 'CUSTOMER',
): Promise<{ account: CustomerAccount; orders?: PastOrder[] }> => {
  const url = customerId
    ? `${CUSTOMER_API_BASE}/profile/${customerId}`
    : `${CUSTOMER_API_BASE}/profile`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(role),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch customer profile');
  }
  return data;
};

export const updateCustomerProfileOnBackend = async (params: {
  name?: string;
  phone?: string;
  email?: string;
  favouriteDrink?: string;
}): Promise<{ success: boolean; account: CustomerAccount; message: string }> => {
  const res = await fetch(`${CUSTOMER_API_BASE}/profile`, {
    method: 'PUT',
    headers: getAuthHeaders('CUSTOMER'),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update customer profile');
  }
  return data;
};

export const logoutFromBackend = async (
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN' = 'CUSTOMER',
): Promise<{ success: boolean }> => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(role),
    });
  } catch {
    // Ignore network drop on logout
  }
  clearSessionToken(role);
  return { success: true };
};

export const logoutSessionOnBackend = logoutFromBackend;

// ============================================================================
// ORDERS API
// ============================================================================

export const createOrderOnBackend = async (
  orderPayload: any,
): Promise<{ success: boolean; order: PastOrder; message?: string }> => {
  const res = await fetch(ORDERS_API_BASE, {
    method: 'POST',
    headers: getAuthHeaders('CUSTOMER'),
    body: JSON.stringify(orderPayload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to create order');
  }
  return data;
};

export const fetchOrderByIdFromBackend = async (
  orderId: string,
): Promise<{ order: PastOrder }> => {
  const res = await fetch(`${ORDERS_API_BASE}/${encodeURIComponent(orderId)}`, {
    headers: getAuthHeaders('CUSTOMER'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Order not found');
  }
  return data;
};

export const fetchMyOrdersFromBackend = async (): Promise<{ orders: PastOrder[] }> => {
  const res = await fetch(`${ORDERS_API_BASE}/my`, {
    headers: getAuthHeaders('CUSTOMER'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch customer orders');
  }
  return data;
};

export const fetchOrdersFromBackend = async (params: {
  limit?: number;
  status?: string;
  role?: 'STAFF' | 'ADMIN';
} = {}): Promise<{ orders: PastOrder[] }> => {
  const role = params.role || 'STAFF';
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);

  const res = await fetch(`${MANAGEMENT_API_BASE}/orders?${query.toString()}`, {
    headers: getAuthHeaders(role),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch management orders');
  }
  return data;
};

export const updateOrderStatusOnBackend = async (
  orderId: string,
  status: string,
  role: 'STAFF' | 'ADMIN' = 'STAFF',
): Promise<{ success: boolean; order: PastOrder; message?: string }> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PUT',
      headers: getAuthHeaders(role),
      body: JSON.stringify({ status }),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update order status');
  }
  return data;
};

// ============================================================================
// STAFF & ADMIN AUTHENTICATION
// ============================================================================

export const verifyManagementSessionOnBackend = async (
  role: 'STAFF' | 'ADMIN',
): Promise<{ valid: boolean; staff?: any }> => {
  try {
    const res = await fetch('/api/auth/verify', {
      headers: getAuthHeaders(role),
    });
    if (!res.ok) return { valid: false };
    const data = await res.json();
    return { valid: true, staff: data.staff };
  } catch {
    return { valid: false };
  }
};

export const fetchAdminDashboardFromBackend = async (): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/overview`, {
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch admin overview');
  }
  return data;
};

export const fetchManagementOverviewFromBackend = async (
  role: 'STAFF' | 'ADMIN' = 'STAFF',
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/overview`, {
    headers: getAuthHeaders(role),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch management overview');
  }
  return data;
};

// ============================================================================
// CUSTOMERS MANAGEMENT (ADMIN ONLY)
// ============================================================================

export const fetchManagementCustomersFromBackend = async (params: {
  q?: string;
  status?: string;
} = {}): Promise<{ customers: any[] }> => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);

  const res = await fetch(`${MANAGEMENT_API_BASE}/customers?${query.toString()}`, {
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch customers');
  }
  return data;
};

export const updateManagementCustomerOnBackend = async (
  customerId: string,
  updates: any,
): Promise<{ success: boolean; customer: any; message: string }> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/customers/${encodeURIComponent(customerId)}`,
    {
      method: 'PUT',
      headers: getAuthHeaders('ADMIN'),
      body: JSON.stringify(updates),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update customer');
  }
  return data;
};

export const updateManagementCustomerStatusOnBackend = updateManagementCustomerOnBackend;

// ============================================================================
// MENU MANAGEMENT
// ============================================================================

export const fetchManagementMenuFromBackend = async (
  role: 'STAFF' | 'ADMIN' = 'STAFF',
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/menu`, {
    headers: getAuthHeaders(role),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch menu');
  }
  return data;
};

export const updateManagementMenuItemOnBackend = async (
  itemId: string,
  updates: any,
  role: 'STAFF' | 'ADMIN' = 'STAFF',
): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/menu/${encodeURIComponent(itemId)}`,
    {
      method: 'PUT',
      headers: getAuthHeaders(role),
      body: JSON.stringify(updates),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update menu item');
  }
  return data;
};

export const createManagementMenuItemOnBackend = async (
  item: any,
  role: 'STAFF' | 'ADMIN' = 'ADMIN',
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/menu`, {
    method: 'POST',
    headers: getAuthHeaders(role),
    body: JSON.stringify(item),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create menu item');
  }
  return data;
};

// ============================================================================
// REVIEWS MANAGEMENT
// ============================================================================

export const fetchManagementReviewsFromBackend = async (
  role: 'STAFF' | 'ADMIN' = 'STAFF',
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/reviews`, {
    headers: getAuthHeaders(role),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch reviews');
  }
  return data;
};

export const refreshManagementReviewsOnBackend = async (): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/reviews/refresh`, {
    method: 'POST',
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to refresh reviews');
  }
  return data;
};

// ============================================================================
// ANALYTICS & AUDIT LOGS
// ============================================================================

export const fetchManagementAnalyticsFromBackend = async (
  period: string = '7d',
): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/analytics?period=${encodeURIComponent(period)}`,
    {
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch analytics');
  }
  return data;
};

export const fetchManagementAuditLogsFromBackend = async (
  filter: string = 'ALL',
): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/audit-logs?filter=${encodeURIComponent(filter)}`,
    {
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch audit logs');
  }
  return data;
};

// ============================================================================
// STAFF MANAGEMENT
// ============================================================================

export const fetchManagementStaffFromBackend = async (): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/staff`, {
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch staff directory');
  }
  return data;
};

export const addManagementStaffOnBackend = async (staffMember: any): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/staff`, {
    method: 'POST',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(staffMember),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create staff member');
  }
  return data;
};

export const updateManagementStaffOnBackend = async (
  staffId: string,
  updates: any,
): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/staff/${encodeURIComponent(staffId)}`,
    {
      method: 'PUT',
      headers: getAuthHeaders('ADMIN'),
      body: JSON.stringify(updates),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update staff member');
  }
  return data;
};

export const revokeStaffSessionsOnBackend = async (staffId: string): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/staff/${encodeURIComponent(staffId)}/revoke-sessions`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to revoke staff sessions');
  }
  return data;
};

// ============================================================================
// STORE SETTINGS
// ============================================================================

export const fetchManagementSettingsFromBackend = async (): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/settings`, {
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch settings');
  }
  return data;
};

export const updateManagementSettingsOnBackend = async (settings: any): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/settings`, {
    method: 'PUT',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update settings');
  }
  return data;
};

// ============================================================================
// SPECIALS MANAGEMENT
// ============================================================================

export const fetchManagementSpecialsFromBackend = async (
  role: 'STAFF' | 'ADMIN' = 'STAFF',
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/specials`, {
    headers: getAuthHeaders(role),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch specials');
  }
  return data;
};

export const createManagementSpecialOnBackend = async (special: any): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/specials`, {
    method: 'POST',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(special),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create special');
  }
  return data;
};

export const updateManagementSpecialOnBackend = async (
  id: string,
  updates: any,
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/specials/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update special');
  }
  return data;
};

export const publishManagementSpecialOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/specials/${encodeURIComponent(id)}/publish`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to publish special');
  }
  return data;
};

export const unpublishManagementSpecialOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/specials/${encodeURIComponent(id)}/unpublish`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to unpublish special');
  }
  return data;
};

export const toggleManagementSpecialOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/specials/${encodeURIComponent(id)}/toggle`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to toggle special');
  }
  return data;
};

export const deleteManagementSpecialOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/specials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete special');
  }
  return data;
};

// ============================================================================
// DAILY QUIZ API
// ============================================================================

export const fetchTodayQuizFromBackend = async (): Promise<DailyQuiz> => {
  const res = await fetch('/api/quiz/today', {
    headers: getAuthHeaders('CUSTOMER'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load today quiz');
  }
  return data.quiz;
};

export const submitQuizAnswersToBackend = async (params: {
  quizId: string;
  selectedOptionIndex: number;
}): Promise<any> => {
  const res = await fetch('/api/quiz/submit', {
    method: 'POST',
    headers: getAuthHeaders('CUSTOMER'),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to submit quiz');
  }
  return data;
};

export const fetchCustomerQuizPointsFromBackend = async (): Promise<{
  points: number;
  totalAttempts: number;
}> => {
  const res = await fetch('/api/quiz/my-points', {
    headers: getAuthHeaders('CUSTOMER'),
  });
  const data = await res.json();
  if (!res.ok) {
    return { points: 0, totalAttempts: 0 };
  }
  return data;
};

export const fetchQuizLeaderboardFromBackend = async (): Promise<QuizLeaderboardData> => {
  const res = await fetch('/api/quiz/leaderboard');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load quiz leaderboard');
  }
  return data;
};

export const fetchManagementQuizzesFromBackend = async (): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/quizzes`, {
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch quizzes');
  }
  return data;
};

export const createManagementQuizOnBackend = async (quiz: any): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/quizzes`, {
    method: 'POST',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(quiz),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create quiz');
  }
  return data;
};

export const updateManagementQuizOnBackend = async (
  id: string,
  updates: any,
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/quizzes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update quiz');
  }
  return data;
};

export const publishManagementQuizOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/quizzes/${encodeURIComponent(id)}/publish`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to publish quiz');
  }
  return data;
};

export const unpublishManagementQuizOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/quizzes/${encodeURIComponent(id)}/unpublish`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to unpublish quiz');
  }
  return data;
};

export const deleteManagementQuizOnBackend = async (id: string): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/quizzes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete quiz');
  }
  return data;
};

// ============================================================================
// WEEKLY COMPETITIONS API
// ============================================================================

export const fetchCurrentCompetitionFromBackend = async (): Promise<WeeklyCompetition | null> => {
  const res = await fetch('/api/competitions/current', {
    headers: getAuthHeaders('CUSTOMER'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch competition');
  }
  return data.competition;
};

export const joinCompetitionOnBackend = async (competitionId: string): Promise<any> => {
  const res = await fetch(
    `/api/competitions/${encodeURIComponent(competitionId)}/join`,
    {
      method: 'POST',
      headers: getAuthHeaders('CUSTOMER'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to enter competition');
  }
  return data;
};

export const fetchManagementCompetitionsFromBackend = async (): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/competitions`, {
    headers: getAuthHeaders('ADMIN'),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch competitions');
  }
  return data;
};

export const createManagementCompetitionOnBackend = async (
  competition: any,
): Promise<any> => {
  const res = await fetch(`${MANAGEMENT_API_BASE}/competitions`, {
    method: 'POST',
    headers: getAuthHeaders('ADMIN'),
    body: JSON.stringify(competition),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create competition');
  }
  return data;
};

export const drawCompetitionWinnersOnBackend = async (
  competitionId: string,
): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/competitions/${encodeURIComponent(competitionId)}/draw`,
    {
      method: 'POST',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to draw winners');
  }
  return data;
};

export const deleteManagementCompetitionOnBackend = async (
  competitionId: string,
): Promise<any> => {
  const res = await fetch(
    `${MANAGEMENT_API_BASE}/competitions/${encodeURIComponent(competitionId)}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders('ADMIN'),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete competition');
  }
  return data;
};
