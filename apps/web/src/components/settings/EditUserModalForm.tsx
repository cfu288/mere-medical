import { Transition, Dialog } from '@headlessui/react';
import { Fragment, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRxUserDocument } from '../providers/UserProvider';
import { SubmitHandler, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format } from 'date-fns';

export type NewUserFormFields = {
  birthday?: string | Date;
  email?: string;
  firstName?: string;
  gender?: string;
  lastName?: string;
  profilePhoto?: FileList;
};

export const validSchema = yup.object({
  firstName: yup.string().required(),
  lastName: yup.string().required(),
  email: yup.string().email().required(),
  birthday: yup.date().required(),
  gender: yup.string(),
});

export function parseDefaultValues(defaultValues?: NewUserFormFields) {
  const bd =
    defaultValues?.birthday &&
    format(new Date(defaultValues?.birthday), 'yyyy-MM-dd');
  return {
    firstName: defaultValues?.firstName || '',
    lastName: defaultValues?.lastName || '',
    email: defaultValues?.email || '',
    birthday: bd || '',
    gender: defaultValues?.gender || '',
    profilePhoto: defaultValues?.profilePhoto || undefined,
  };
}

function getFileFromFileList(fileOrFileList: FileList | File | undefined) {
  let pp: File | null;
  try {
    pp = (fileOrFileList as unknown as FileList)?.item(0);
  } catch (e) {
    pp = fileOrFileList as unknown as File;
  }
  return pp;
}

function getBase64(file: File): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    console.log(typeof file);
    console.log(file);
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

type ProfilePhotoMetadata = { data: string; content_type: string };

function tryCreateUrl(pp: ProfilePhotoMetadata | Blob): string {
  try {
    return URL.createObjectURL(pp as unknown as Blob);
  } catch {
    return (pp as unknown as ProfilePhotoMetadata)?.data;
  }
}

export function EditUserModalForm({
  defaultValues,
  modalOpen,
  toggleModal,
}: {
  defaultValues?: NewUserFormFields;
  modalOpen: boolean;
  toggleModal: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: parseDefaultValues(defaultValues),
    resolver: yupResolver(validSchema),
  });

  useEffect(() => {
    reset(parseDefaultValues(defaultValues));
  }, [defaultValues, reset]);

  const cancelButtonRef = useRef(null),
    rawUser = useRxUserDocument(),
    submitUser: SubmitHandler<NewUserFormFields> = (data) => {
      if (rawUser) {
        rawUser
          .update({
            $set: {
              birthday: (data.birthday as Date)?.toISOString(),
              email: data.email,
              first_name: data.firstName,
              gender: data.gender,
              is_default_user: false,
              is_selected_user: true,
              last_name: data.lastName,
            },
          })
          .then(async () => {
            const pp = getFileFromFileList(data.profilePhoto);
            if (pp && (pp instanceof File || (pp as unknown) instanceof Blob)) {
              rawUser.update({
                $set: {
                  profile_picture: {
                    content_type: pp?.type,
                    data: await getBase64(pp),
                  },
                },
              });
            } else {
              const ppMeta = pp as unknown as ProfilePhotoMetadata;
              if (ppMeta) {
                rawUser.update({
                  $set: {
                    profile_picture: {
                      content_type: ppMeta?.content_type,
                      data: ppMeta.data,
                    },
                  },
                });
              }
            }
            toggleModal();
          });
      }
    };

  const pp = getFileFromFileList(watch('profilePhoto'));

  return (
    <Transition.Root show={modalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-30"
        initialFocus={cancelButtonRef}
        onClose={toggleModal}
      >
        {/* background */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-primary fixed inset-0 bg-opacity-50 transition-opacity" />
        </Transition.Child>

        {/* modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="pointer-events-auto w-screen max-w-xl">
                <form
                  className="flex h-full flex-col divide-y divide-gray-200 rounded-lg bg-white shadow-xl"
                  onSubmit={handleSubmit(submitUser)}
                >
                  <div className="h-0 flex-1 overflow-y-auto rounded-lg">
                    <div className="bg-primary-700 py-6 px-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-lg font-medium text-white">
                          Tell us about yourself
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="bg-primary-700 text-primary-200 rounded-md hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                            onClick={toggleModal}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-left text-sm text-white text-opacity-95">
                          Provide some more information about yourself so we can
                          link your medical records to you.
                        </p>
                      </div>
                    </div>
                    {/* user info */}
                    <div className="m-2 mb-6 space-y-6 sm:space-y-5">
                      <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-gray-200 sm:pt-5">
                        <label
                          htmlFor="first-name"
                          className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
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
                            aria-invalid={errors.firstName ? 'true' : 'false'}
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
                          className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
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
                            aria-invalid={errors.lastName ? 'true' : 'false'}
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
                          className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
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
                            aria-invalid={errors.email ? 'true' : 'false'}
                          />
                          {errors.email?.type === 'required' && (
                            <p className="text-sm text-red-500 sm:max-w-xs">
                              Email is required
                            </p>
                          )}
                          {errors.email &&
                            errors.email?.type !== 'required' && (
                              <p className="text-sm text-red-500 sm:max-w-xs">
                                Email must be valid
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                        <label
                          htmlFor="date-of-birth"
                          className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
                        >
                          Date of Birth
                        </label>
                        <div className="mt-1 sm:col-span-2 sm:mt-0">
                          <input
                            id="date-of-birth"
                            type="date"
                            autoComplete="date"
                            className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                            {...register('birthday')}
                            aria-invalid={errors.birthday ? 'true' : 'false'}
                          />
                          {errors.birthday?.type === 'required' && (
                            <p className="text-sm text-red-500 sm:max-w-xs">
                              Birthday is required
                            </p>
                          )}
                          {errors.birthday &&
                            errors.birthday?.type !== 'required' && (
                              <p className="text-sm text-red-500 sm:max-w-xs">
                                Birthday is invalid
                              </p>
                            )}
                        </div>
                      </div>
                      <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                        <label
                          htmlFor="gender"
                          className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
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
                            aria-invalid={errors.gender ? 'true' : 'false'}
                          />
                          {errors.birthday?.type === 'required' && (
                            <p className="text-sm text-red-500 sm:max-w-xs">
                              Gender is required
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="sm:grid sm:grid-cols-3 sm:items-center sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                        <label
                          htmlFor="photo"
                          className="block text-sm font-medium text-gray-700"
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
                                  src={tryCreateUrl(pp)}
                                  alt="profile"
                                ></img>
                              )}
                            </span>
                            <input
                              type="file"
                              id="profilePhoto"
                              className="file:focus:ring-primary-500 file:text-medium block w-full flex-1 py-2 text-sm text-gray-500 file:ml-5 file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-white  file:py-2 file:px-3 file:text-gray-700 hover:file:bg-gray-100 focus:outline-none file:focus:outline-none file:focus:ring-2 file:focus:ring-offset-2"
                              accept="image/png, image/jpeg"
                              {...register('profilePhoto')}
                              aria-invalid={
                                errors.profilePhoto ? 'true' : 'false'
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 justify-end px-4 py-4">
                    <button
                      type="button"
                      className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      onClick={toggleModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
