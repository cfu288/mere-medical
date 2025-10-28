import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUserManagement } from '../providers/UserProvider';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { SubmitHandler, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Modal } from '../Modal';
import {
  NewUserFormFields,
  validSchema,
  parseDefaultValues,
  ProfileImageModal,
} from './EditUserModalForm';
import { getFileFromFileList, useObjectUrl } from '../../utils/FileUtils';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onUserCreated?: (userId: string) => void;
  switchToNewUser?: boolean;
}

export function AddUserModal({
  open,
  onClose,
  onUserCreated,
  switchToNewUser = false,
}: AddUserModalProps) {
  const { createNewUser, switchUser } = useUserManagement();
  const notificationDispatch = useNotificationDispatch();
  const [togglePhotoModal, setTogglePhotoModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    reset,
  } = useForm<NewUserFormFields>({
    defaultValues: parseDefaultValues({}),
    resolver: yupResolver(validSchema),
  });

  const pp = getFileFromFileList(watch('profilePhoto'));
  const profilePhotoUrl = useObjectUrl(pp);

  const submitNewUser: SubmitHandler<NewUserFormFields> = async (data) => {
    try {
      const newUserDoc = await createNewUser({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        birthday: (data.birthday as Date)?.toISOString(),
        gender: data.gender,
        profile_picture: pp
          ? {
              content_type: 'image/png',
              data: pp as string,
            }
          : undefined,
      });

      const newUserId = newUserDoc.get('id');

      if (!newUserId) {
        throw new Error('Failed to get new user ID');
      }

      notificationDispatch({
        type: 'set_notification',
        message: `Successfully created user ${data.firstName} ${data.lastName}`,
        variant: 'success',
      });

      if (switchToNewUser) {
        await switchUser(newUserId);
        notificationDispatch({
          type: 'set_notification',
          message: `Switched to ${data.firstName} ${data.lastName}`,
          variant: 'success',
        });
      }

      reset();
      onClose();

      if (onUserCreated) {
        onUserCreated(newUserId);
      }
    } catch (error) {
      notificationDispatch({
        type: 'set_notification',
        message: `Error creating user: ${(error as Error).message}`,
        variant: 'error',
      });
    }
  };

  return (
    <>
      <Modal open={open} setOpen={onClose}>
        <form
          className="flex h-full flex-col divide-y divide-gray-200 rounded-lg bg-white shadow-xl"
          onSubmit={handleSubmit(submitNewUser)}
        >
          <div className="h-0 flex-1 overflow-y-auto rounded-lg">
            <div className="bg-primary-700 px-4 py-6 sm:px-6">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-medium text-white">
                  Add New User
                </Dialog.Title>
                <div className="ml-3 flex h-7 items-center">
                  <button
                    type="button"
                    className="bg-primary-700 rounded-md text-white hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close panel</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-1">
                <p className="text-left text-sm text-white text-opacity-95">
                  Create a new user profile to manage separate medical records.
                </p>
              </div>
            </div>
            {/* User form fields */}
            <div className="m-2 mb-6 space-y-6 p-4 sm:space-y-5">
              <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-gray-200 sm:pt-5">
                <label
                  htmlFor="first-name"
                  className="block text-sm font-medium text-gray-800 sm:mt-px sm:pt-2"
                >
                  First name
                </label>
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <input
                    type="text"
                    id="first-name"
                    autoComplete="given-name"
                    className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                    {...register('firstName')}
                    aria-invalid={!!errors.firstName}
                  />
                  {errors.firstName?.type === 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      First name is required
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-800 sm:mt-px sm:pt-2"
                >
                  Last name
                </label>
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <input
                    type="text"
                    id="last-name"
                    autoComplete="family-name"
                    className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                    {...register('lastName')}
                    aria-invalid={!!errors.lastName}
                  />
                  {errors.lastName?.type === 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      Last name is required
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-800 sm:mt-px sm:pt-2"
                >
                  Email address
                </label>
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <input
                    id="email"
                    type="text"
                    autoComplete="email"
                    className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                    {...register('email')}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email?.type === 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      Email is required
                    </p>
                  )}
                  {errors.email && errors.email?.type !== 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      Email must be valid
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                <label
                  htmlFor="date-of-birth"
                  className="block text-sm font-medium text-gray-800 sm:mt-px sm:pt-2"
                >
                  Date of Birth
                </label>
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <input
                    id="date-of-birth"
                    type="date"
                    autoComplete="bday"
                    className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                    {...register('birthday')}
                    aria-invalid={!!errors.birthday}
                  />
                  {errors.birthday?.type === 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      Birthday is required
                    </p>
                  )}
                  {errors.birthday && errors.birthday?.type !== 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      Birthday is invalid
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                <label
                  htmlFor="gender"
                  className="block text-sm font-medium text-gray-800 sm:mt-px sm:pt-2"
                >
                  Gender
                </label>
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <input
                    type="text"
                    id="gender"
                    autoComplete="gender"
                    className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                    {...register('gender')}
                    aria-invalid={!!errors.gender}
                  />
                  {errors.gender?.type === 'required' && (
                    <p className="text-sm text-red-500 sm:max-w-xs">
                      Gender is required
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:grid sm:grid-cols-3 sm:items-center sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                <label
                  htmlFor="photo"
                  className="block text-sm font-medium text-gray-800"
                >
                  Photo
                </label>
                <div className="mt-1 sm:col-span-2 sm:mt-0">
                  <div className="flex items-center justify-between">
                    <span className="flex-0 h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                      {!pp ? (
                        <svg
                          className="h-full w-full text-gray-300"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <img
                          className="h-full w-full text-gray-300"
                          src={profilePhotoUrl}
                          alt="profile"
                        ></img>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setTogglePhotoModal((x) => !x);
                      }}
                      className="file:focus:ring-primary-500 file:text-medium block w-full flex-1 py-2 text-sm text-gray-800 file:ml-5 file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-white  file:px-3 file:py-2 file:text-gray-800 hover:file:bg-gray-100 focus:outline-none file:focus:outline-none file:focus:ring-2 file:focus:ring-offset-2"
                    >
                      Upload photo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 justify-end px-4 py-4">
            <button
              type="button"
              className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              Create User
            </button>
          </div>
        </form>
      </Modal>
      <ProfileImageModal
        setPP={(i) => {
          setValue('profilePhoto', i);
        }}
        pp={pp || null}
        togglePhotoModal={togglePhotoModal}
        setTogglePhotoModal={setTogglePhotoModal}
      />
    </>
  );
}
