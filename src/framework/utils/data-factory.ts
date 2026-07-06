export type Customer = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
};

export type Address = {
  address1: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
};

export function newCustomer(overrides: Partial<Customer> = {}): Customer {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    firstName: 'Quality',
    lastName: 'Gate',
    email: `qa-${suffix}@example.com`,
    password: 'CorrectHorseBatteryStaple!23',
    phone: '5555550100',
    ...overrides,
  };
}

export function defaultShipping(overrides: Partial<Address> = {}): Address {
  return {
    address1: '100 Quality Way',
    city: 'New York',
    province: 'NY',
    postalCode: '10001',
    countryCode: 'us',
    ...overrides,
  };
}
