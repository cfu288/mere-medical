import { zodResolver } from '@hookform/resolvers/zod';
import { validSchema } from './EditUserModalForm';

const resolve = async (values: Record<string, unknown>) =>
  zodResolver(validSchema)(values, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  birthday: '',
  gender: '',
};

const validForm = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  birthday: '1990-05-01',
  gender: '',
};

describe('user form validation schema', () => {
  it('reports a message for every missing required field', async () => {
    const { errors } = await resolve(emptyForm);
    expect(
      Object.fromEntries(
        Object.entries(errors).map(([k, v]) => [k, v?.message]),
      ),
    ).toEqual({
      firstName: 'First name is required',
      lastName: 'Last name is required',
      email: 'Email is required',
      birthday: 'Birthday is required',
    });
  });

  it('rejects a malformed email with the visible message', async () => {
    const { errors } = await resolve({ ...validForm, email: 'not-an-email' });
    expect(Object.keys(errors)).toEqual(['email']);
    expect(errors['email']?.message).toBe('Email must be valid');
  });

  // yup accepted dotless domains and single-letter TLDs; the ported WHATWG
  // pattern must keep accepting them so the zod swap changes no behavior
  it.each([
    ['grace@invalid', true],
    ['user@localhost', true],
    ['a@b.c', true],
    ['trailing.@x.com', true],
    ['a@sub.domain.com', true],
    ['weird+tag@gmail.com', true],
    ['no-at-sign', false],
    ['spaces in@x.com', false],
    ['a@-bad.com', false],
  ])('email %s is accepted: %s', async (email, accepted) => {
    const { errors } = await resolve({ ...validForm, email });
    expect(!errors['email']).toBe(accepted);
  });

  it('parses the birthday as local time, not UTC', async () => {
    const { values, errors } = await resolve(validForm);
    expect(errors).toEqual({});
    const birthday = (values as { birthday: Date }).birthday;
    expect(birthday).toBeInstanceOf(Date);
    expect([
      birthday.getFullYear(),
      birthday.getMonth(),
      birthday.getDate(),
    ]).toEqual([1990, 4, 1]);
  });

  it('rejects an unparseable birthday with the visible message', async () => {
    const { errors } = await resolve({ ...validForm, birthday: 'garbage' });
    expect(errors['birthday']?.message).toBe('Birthday is invalid');
  });

  it('accepts a Date instance for birthday, as NewUserFormFields allows', async () => {
    const date = new Date(1990, 4, 1);
    const { values, errors } = await resolve({ ...validForm, birthday: date });
    expect(errors).toEqual({});
    expect((values as { birthday: Date }).birthday.getTime()).toBe(
      date.getTime(),
    );
  });

  it('keeps low years literal instead of applying the 1900 mapping yup inherited from new Date(99, ...)', async () => {
    const { values, errors } = await resolve({
      ...validForm,
      birthday: '0099-05-01',
    });
    expect(errors).toEqual({});
    expect((values as { birthday: Date }).birthday.getFullYear()).toBe(99);
  });

  it('accepts gender as optional and preserves an entered value', async () => {
    const filled = await resolve({ ...validForm, gender: 'Female' });
    expect(filled.errors).toEqual({});
    expect((filled.values as { gender: string }).gender).toBe('Female');

    const absent = await resolve({ ...validForm, gender: undefined });
    expect(absent.errors).toEqual({});
  });

  it('passes unknown fields like profilePhoto through to the submit handler', async () => {
    const { values } = await resolve({
      ...validForm,
      profilePhoto: 'data:image/png;base64,xyz',
    });
    expect((values as { profilePhoto: string }).profilePhoto).toBe(
      'data:image/png;base64,xyz',
    );
  });
});
