import { CustomerAccount, CustomerProfile } from '../types/customer';
import { PastOrder, CartItem } from '../types/coffee';
import {
  requestCustomerOtpOnBackend,
  verifyCustomerOtpOnBackend,
  fetchCustomerProfileFromBackend,
  updateCustomerProfileOnBackend,
  logoutFromBackend,
  getSessionToken,
  clearSessionToken,
  fetchOrderByIdFromBackend,
} from './api';

export type LoyaltyCustomer = CustomerAccount;

export const ACTIVE_CUSTOMER_KEY = 'venty_customer_active_account_v1';
export const PAST_ORDERS_KEY = 'venty_past_orders_v1';

export const normalizePhoneNumber = (rawPhone: string): string => {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let cleaned = rawPhone.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+213')) {
    cleaned = cleaned.substring(4);
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    return `0${cleaned.replace(/\D/g, '')}`;
  }
  if (cleaned.startsWith('00213')) {
    cleaned = cleaned.substring(5);
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    return `0${cleaned.replace(/\D/g, '')}`;
  }
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.startsWith('213') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    const rest = digitsOnly.substring(3);
    return rest.startsWith('0') ? rest : `0${rest}`;
  }
  if (digitsOnly.length === 9 && /^[567]/.test(digitsOnly)) {
    return `0${digitsOnly}`;
  }
  return digitsOnly;
};

export const getActiveCustomer = (): CustomerAccount | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setActiveCustomer = (customer: CustomerAccount | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (customer) {
      localStorage.setItem(ACTIVE_CUSTOMER_KEY, JSON.stringify(customer));
    } else {
      localStorage.removeItem(ACTIVE_CUSTOMER_KEY);
    }
    window.dispatchEvent(
      new CustomEvent('venty:customer:updated', {
        detail: { customer },
      }),
    );
  } catch {
    // Storage quota or private browsing mode handling
  }
};

export const setActiveLoyaltyAccount = setActiveCustomer;
export const getActiveLoyaltyAccount = getActiveCustomer;

export const getCustomerOrders = (): PastOrder[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAST_ORDERS_KEY);
    if (!raw) return [];
    const allOrders: PastOrder[] = JSON.parse(raw);
    const active = getActiveCustomer();
    if (!active) return allOrders;
    return allOrders.filter(
      (o) =>
        o.customerId === active.customerId ||
        (o.customerPhone && normalizePhoneNumber(o.customerPhone) === normalizePhoneNumber(active.phone)),
    );
  } catch {
    return [];
  }
};

export const requestCustomerOtp = async (params: {
  phone: string;
  name?: string;
  email?: string;
  favouriteDrink?: string;
  purpose?: 'LOGIN' | 'SIGNUP' | 'VERIFY';
}): Promise<{ success: boolean; message: string; simulatedCode?: string }> => {
  return requestCustomerOtpOnBackend(params);
};

export const verifyCustomerOtp = async (params: {
  phone: string;
  code: string;
  email?: string;
  name?: string;
  favouriteDrink?: string;
}): Promise<{
  success: boolean;
  created: boolean;
  customer: CustomerAccount | null;
  orders?: PastOrder[];
  message: string;
}> => {
  try {
    const res = await verifyCustomerOtpOnBackend(params);
    if (res.account) {
      setActiveCustomer(res.account);
      if (Array.isArray(res.orders) && typeof window !== 'undefined') {
        localStorage.setItem(PAST_ORDERS_KEY, JSON.stringify(res.orders));
        window.dispatchEvent(
          new CustomEvent('venty:orders:updated', {
            detail: { orders: res.orders },
          }),
        );
      }
      return {
        success: true,
        created: Boolean(res.created),
        customer: res.account,
        orders: res.orders,
        message: res.message || `Welcome, ${res.account.name}!`,
      };
    }
    return {
      success: false,
      created: false,
      customer: null,
      message: res.message || 'Verification failed. Please check your code and try again.',
    };
  } catch (err: any) {
    return {
      success: false,
      created: false,
      customer: null,
      message: err?.message || 'Verification failed. Please check your code and try again.',
    };
  }
};

export const loginCustomerPasswordless = async (params: {
  phone: string;
  code?: string;
  email?: string;
}): Promise<{
  success: boolean;
  customer: CustomerAccount | null;
  orders?: PastOrder[];
  message: string;
}> => {
  const cleanPhone = normalizePhoneNumber(params.phone);
  if (!cleanPhone) {
    return { success: false, customer: null, message: 'Please provide a valid Algeria phone number.' };
  }

  if (params.code) {
    const vRes = await verifyCustomerOtp({
      phone: params.phone,
      code: params.code,
      email: params.email,
    });
    return {
      success: vRes.success,
      customer: vRes.customer,
      orders: vRes.orders,
      message: vRes.message,
    };
  }

  const reqRes = await requestCustomerOtp({
    phone: params.phone,
    email: params.email,
    purpose: 'LOGIN',
  });
  return {
    success: reqRes.success,
    customer: null,
    message: reqRes.message,
  };
};

export const registerCustomerPasswordless = async (params: {
  name: string;
  phone: string;
  email?: string;
  code?: string;
  favouriteDrink?: string;
}): Promise<{
  success: boolean;
  created: boolean;
  customer: CustomerAccount | null;
  message: string;
}> => {
  const cleanPhone = normalizePhoneNumber(params.phone);
  if (!cleanPhone || !params.name.trim()) {
    return { success: false, created: false, customer: null, message: 'Name and phone number are required.' };
  }

  if (params.code) {
    const vRes = await verifyCustomerOtp({
      name: params.name,
      phone: params.phone,
      code: params.code,
      email: params.email,
      favouriteDrink: params.favouriteDrink,
    });
    return {
      success: vRes.success,
      created: vRes.created,
      customer: vRes.customer,
      message: vRes.message,
    };
  }

  const reqRes = await requestCustomerOtp({
    name: params.name,
    phone: params.phone,
    email: params.email,
    favouriteDrink: params.favouriteDrink,
    purpose: 'SIGNUP',
  });
  return {
    success: reqRes.success,
    created: false,
    customer: null,
    message: reqRes.message,
  };
};

export const loginCustomerWithPassword = async (params: {
  phone: string;
  password?: string;
  code?: string;
  email?: string;
}) => {
  return loginCustomerPasswordless({
    phone: params.phone,
    code: params.code || params.password,
    email: params.email,
  });
};

export const registerCustomerWithPassword = async (params: {
  name: string;
  phone: string;
  email?: string;
  password?: string;
  code?: string;
  favouriteDrink?: string;
}) => {
  return registerCustomerPasswordless({
    name: params.name,
    phone: params.phone,
    email: params.email,
    code: params.code || params.password,
    favouriteDrink: params.favouriteDrink,
  });
};

export const signupCustomerWithPassword = registerCustomerWithPassword;

export const loginLoyaltyCustomer = async (
  phone: string,
  code?: string,
  email?: string,
) => {
  return loginCustomerPasswordless({ phone, code, email });
};

export const logoutCustomer = async (): Promise<void> => {
  await logoutFromBackend('CUSTOMER');
  clearSessionToken('CUSTOMER');
  setActiveCustomer(null);
};

export const logoutLoyaltyCustomer = logoutCustomer;

export const updateCustomerProfile = async (params: {
  name?: string;
  phone?: string;
  email?: string;
  favouriteDrink?: string;
}): Promise<{ success: boolean; customer: CustomerAccount | null; message: string }> => {
  try {
    const res = await updateCustomerProfileOnBackend(params);
    if (res.account) {
      setActiveCustomer(res.account);
      return {
        success: true,
        customer: res.account,
        message: res.message || 'Profile updated.',
      };
    }
  } catch (err: any) {
    const active = getActiveCustomer();
    if (active) {
      const updated: CustomerAccount = {
        ...active,
        name: params.name?.trim() || active.name,
        phone: params.phone?.trim() || active.phone,
        email: params.email !== undefined ? params.email.trim() || undefined : active.email,
        favouriteDrink: params.favouriteDrink?.trim() || active.favouriteDrink,
        updatedAt: new Date().toISOString(),
      };
      setActiveCustomer(updated);
      return {
        success: true,
        customer: updated,
        message: 'Profile updated.',
      };
    }
    return {
      success: false,
      customer: null,
      message: err?.message || 'Failed to update profile.',
    };
  }
  return { success: false, customer: null, message: 'Failed to update profile.' };
};

export const updateLoyaltyCustomerProfile = updateCustomerProfile;

export const ensureCustomerBackendSession = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  const existingToken = getSessionToken('CUSTOMER');
  if (!existingToken) return;
  try {
    const res = await fetchCustomerProfileFromBackend(undefined, 'CUSTOMER');
    if (res && res.account) {
      setActiveCustomer(res.account);
    }
  } catch {
    // session expired
  }
};

export const createConfirmedOrder = async (orderPayload: any) => {
  const { createOrderOnBackend } = await import('./api');
  return createOrderOnBackend(orderPayload);
};

export const refreshOrderStatusFromBackend = async (orderId: string) => {
  return fetchOrderByIdFromBackend(orderId);
};
