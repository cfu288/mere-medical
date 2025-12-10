import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { EmptyUserPlaceholder } from './EmptyUserPlaceholder';
import { EditUserForm, NewUserFormFields } from './EditUserModalForm';
import { useEffect, useState } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Modal } from '../../../shared/components/Modal';
import {
  fetchPatientRecords,
  parseGivenName,
  parseFamilyName,
  parseEmail,
  parseBirthday,
  parseGender,
} from '../SettingsTab';

export function UserCard() {
  const user = useUser(),
    db = useRxDb(),
    [defaultValues, setDefaultValues] = useState<NewUserFormFields | undefined>(
      undefined,
    ),
    [openEditUserModal, setOpenEditUserModal] = useState(false);

  useEffect(() => {
    fetchPatientRecords(db, user.id).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      const firstName = parseGivenName(
          res.filter((i) => parseGivenName(i) !== undefined)?.[0],
        ),
        lastName = parseFamilyName(
          res.filter((i) => parseFamilyName(i) !== undefined)?.[0],
        ),
        email = parseEmail(res.filter((i) => parseEmail(i) !== undefined)?.[0]),
        birthDate = parseBirthday(
          res.filter((i) => parseBirthday(i) !== undefined)?.[0],
        ),
        gender = parseGender(
          res.filter(
            (i) =>
              parseGender(i) !== undefined &&
              parseGender(i)?.toLocaleLowerCase() !== 'unknown',
          )?.[0],
        );

      setDefaultValues({
        firstName,
        lastName,
        email,
        birthday: birthDate,
        gender,
      });
    });
  }, [db, user.id]);

  return (
    <>
      {(user === undefined || user.is_default_user) && (
        <div className="mx-auto flex max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
          <EmptyUserPlaceholder
            openModal={() => {
              setOpenEditUserModal(true);
            }}
          />
        </div>
      )}
      {user !== undefined && !user.is_default_user && (
        <div className="mx-auto mt-2 flex max-w-sm flex-col px-4 sm:px-6 lg:px-8">
          <li
            key={user.email || user.id}
            className="flex-colrounded-lg relative col-span-1 flex border bg-white text-center"
          >
            <button
              className="absolute top-4 right-4 flex justify-center text-gray-700"
              aria-label="Edit profile"
              onClick={() => {
                setOpenEditUserModal(true);
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <div className="flex flex-1 flex-col p-8">
              {user?.profile_picture?.data ? (
                <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                  <img
                    className="h-full w-full rounded-full text-gray-300"
                    src={user.profile_picture.data}
                    alt="profile"
                  ></img>
                </div>
              ) : (
                <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                  <svg
                    className="h-full w-full rounded-full text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              )}
              <h2 className="text-md mt-6 text-start font-medium text-gray-600">
                Name
              </h2>
              <p className="text-md mt-2 text-start font-medium text-gray-900">
                {user.first_name} {user.last_name}
              </p>
              <h2 className="text-md mt-6 text-start font-medium text-gray-600">
                Birthday
              </h2>
              <p className="text-md mt-2 text-start font-medium text-gray-900">
                {user.birthday && format(new Date(user.birthday), 'MM/dd/yyyy')}
              </p>
              <h2 className="text-md mt-6 text-start font-medium text-gray-600">
                Email
              </h2>
              <p className="text-md mt-2 text-start font-medium text-gray-900">
                {user.email}
              </p>
            </div>
          </li>
        </div>
      )}
      <Modal
        open={openEditUserModal}
        setOpen={() => setOpenEditUserModal((x) => !x)}
      >
        <EditUserForm
          defaultValues={
            !user.is_default_user
              ? ({
                  birthday: user.birthday,
                  email: user.email,
                  firstName: user.first_name,
                  gender: user.gender,
                  lastName: user.last_name,
                  profilePhoto: user.profile_picture,
                } as NewUserFormFields)
              : defaultValues
          }
          toggleModal={() => setOpenEditUserModal((x) => !x)}
        />
      </Modal>
    </>
  );
}
