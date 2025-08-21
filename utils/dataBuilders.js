export function uniqueEmail(prefix = 'user') {
  return `${prefix}+${Date.now()}@example.com`;
}

export function userBuilder(overrides = {}) {
  return {
    firstName: 'Anna',
    lastName: 'Smith',
    email: uniqueEmail('anna'),
    password: 'qwer',
    verification: 'qwer',
    subscribe: false,
    ...overrides,
  };
}
