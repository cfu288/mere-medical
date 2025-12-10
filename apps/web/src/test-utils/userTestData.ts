import { UserDocument } from '../models/user-document/UserDocument.type';
import uuid4 from '../shared/utils/UUIDUtils';

/**
 * Creates a test user with default values.
 * Override any properties by passing them in the partial.
 */
export function createTestUser(
  overrides?: Partial<UserDocument>,
): UserDocument {
  return {
    id: uuid4(),
    is_selected_user: false,
    is_default_user: false,
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    birthday: '1990-01-01T00:00:00.000Z',
    gender: 'other',
    ...overrides,
  };
}

/**
 * Creates a selected test user.
 */
export function createSelectedTestUser(
  overrides?: Partial<UserDocument>,
): UserDocument {
  return createTestUser({
    is_selected_user: true,
    ...overrides,
  });
}

/**
 * Creates the default user (first user created when app starts).
 */
export function createDefaultTestUser(
  overrides?: Partial<UserDocument>,
): UserDocument {
  return createTestUser({
    is_selected_user: true,
    is_default_user: true,
    ...overrides,
  });
}

/**
 * Creates multiple test users with sequential names.
 */
export function createMultipleTestUsers(count: number): UserDocument[] {
  const users: UserDocument[] = [];

  for (let i = 0; i < count; i++) {
    users.push(
      createTestUser({
        first_name: `Test${i + 1}`,
        last_name: `User${i + 1}`,
        email: `test${i + 1}@example.com`,
        is_selected_user: i === 0, // First user is selected by default
      }),
    );
  }

  return users;
}
