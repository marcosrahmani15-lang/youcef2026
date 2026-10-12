export interface CustomerProfile {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  favouriteDrink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAccount extends CustomerProfile {
  id: string;
  accountStatus?: 'Active' | 'Suspended';
}
