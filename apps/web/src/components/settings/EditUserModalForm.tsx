import { Dialog } from '@headlessui/react';
import { useEffect, useRef, useState, useMemo } from 'react';
import ReactCrop, { convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRxUserDocument } from '../providers/UserProvider';
import { SubmitHandler, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { format } from 'date-fns';
import { RxDocument } from 'rxdb';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { PixelCrop } from 'react-image-crop';
import { DependencyList } from 'react';
import { useNotificationDispatch } from '../providers/NotificationProvider';

export type NewUserFormFields = {
  birthday?: string | Date;
  email?: string;
  firstName?: string;
  gender?: string;
  lastName?: string;
  profilePhoto?: FileList | string | undefined;
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

/**
 * Given a file or file list, return either the file itself or the first file in the file list
 * @param fileOrFileList
 * @returns the file
 */
function getFileFromFileList(
  fileOrFileList: FileList | File | string | undefined
) {
  let pp: File | string | null;
  if (fileOrFileList === typeof 'string') {
    return fileOrFileList;
  }
  try {
    pp = (fileOrFileList as unknown as FileList)?.item(0);
  } catch (e) {
    pp = fileOrFileList as unknown as File;
  }
  return pp;
}

type ProfilePhotoMetadata = { data: string; content_type: string };

function tryCreateUrlFromFile(
  pp: ProfilePhotoMetadata | Blob | string
): string {
  if (typeof pp === 'string') {
    return pp;
  } else if (pp instanceof Blob) {
    return URL.createObjectURL(pp as unknown as Blob);
  }
  return (pp as unknown as ProfilePhotoMetadata)?.data;
}

/**
 * Updates the current user with the following data
 * @param rawUserDocument user document to update
 * @param data data to update the user document with
 */
const updateUserInDb = async (
  rawUserDocument: RxDocument<UserDocument>,
  data: NewUserFormFields
) => {
  await rawUserDocument.update({
    $set: {
      birthday: (data.birthday as Date)?.toISOString(),
      email: data.email,
      first_name: data.firstName,
      gender: data.gender,
      is_default_user: false,
      is_selected_user: true,
      last_name: data.lastName,
    },
  });
  const pp = getFileFromFileList(data.profilePhoto);
  if (pp) {
    const secondUpdate = await rawUserDocument.update({
      $set: {
        profile_picture: {
          content_type: 'image/png',
          data: pp,
        },
      },
    });
    return secondUpdate;
  }
};

function ProfileImageModal({
  setTogglePhotoModal,
  togglePhotoModal,
  pp: ppIn,
  setPP,
}: {
  setTogglePhotoModal: (x: boolean) => void;
  togglePhotoModal: boolean;
  pp: string | File | null;
  setPP: (value: string) => void;
}) {
  const {
    register,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: { profilePhoto: ppIn },
  });
  const [crop, setCrop] = useState<any>({
    unit: 'px',
    aspect: 1 / 1,
    x: 5,
    y: 5,
    width: 100,
    height: 100,
  });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const ppWatch = watch('profilePhoto');
  const pp = useMemo(() => {
    // @ts-ignore
    return getFileFromFileList(ppWatch);
  }, [ppWatch]);
  const ppUrl = useMemo(() => {
    // @ts-ignore
    return tryCreateUrlFromFile(pp);
  }, [pp]);
  const uploadRef = useRef<HTMLInputElement | undefined>();
  const { ref, ...rest } = register('profilePhoto');

  useDebounceEffect(
    async () => {
      if (
        completedCrop?.width &&
        completedCrop?.height &&
        imgRef.current &&
        previewCanvasRef.current
      ) {
        // We use canvasPreview as it's much faster than imgPreview.
        canvasPreview(imgRef.current, previewCanvasRef.current, completedCrop);
      }
    },
    100,
    [completedCrop]
  );

  return (
    <Modal open={togglePhotoModal} setOpen={() => setTogglePhotoModal(false)}>
      <ModalHeader
        title={'Select your profile photo'}
        setClose={() => setTogglePhotoModal(false)}
      />
      <form
        className="mt-4 divide-y divide-gray-200"
        onSubmit={(e) => {
          e.preventDefault();
          setCompletedCrop(convertToPixelCrop(crop, crop.width, crop.height));
          const dt = previewCanvasRef.current?.toDataURL('image/png');
          if (dt) {
            setPP(dt);
            setTogglePhotoModal(false);
          }
        }}
      >
        {!!errors.profilePhoto && (
          <p className="text-red-500">{JSON.stringify(errors)}</p>
        )}
        <div className="flex w-full items-center justify-center pb-4">
          <ReactCrop
            crop={crop}
            onChange={(newCrop: any) => {
              setCrop(newCrop);
            }}
            aspect={1}
            onComplete={(crop) => {
              setCompletedCrop(
                convertToPixelCrop(crop, crop.width, crop.height)
              );
            }}
          >
            {!pp ? (
              <svg
                className="h-64 w-64 text-gray-300"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <>
                <img
                  ref={imgRef}
                  className="h-64 w-auto"
                  src={ppUrl}
                  alt="profile"
                ></img>
                <canvas
                  ref={previewCanvasRef}
                  hidden
                  style={{
                    objectFit: 'contain',
                    width: '300px',
                    height: '300px',
                  }}
                />
              </>
            )}
          </ReactCrop>
        </div>
        <div className="flex flex-shrink-0 justify-end px-4 py-4">
          <input
            type="file"
            id="profilePhoto"
            className="hidden"
            accept="image/*"
            aria-invalid={errors.profilePhoto ? 'true' : 'false'}
            {...rest}
            ref={(e) => {
              ref(e);
              uploadRef.current = e as any;
            }}
          />
          <button
            className='className="focus:ring-primary-500 focus:ring-offset-2" rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2'
            onClick={() => uploadRef.current?.click()}
            type="button"
          >
            Select a new photo
          </button>
          <button
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            type="submit"
          >
            Use Photo
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function EditUserForm({
  defaultValues,
  toggleModal,
}: {
  defaultValues?: NewUserFormFields;
  toggleModal: () => void;
}) {
  const notificationDispatch = useNotificationDispatch();
  const rawUser = useRxUserDocument();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm({
    defaultValues: parseDefaultValues(defaultValues),
    resolver: yupResolver(validSchema),
  });
  const [togglePhotoModal, setTogglePhotoModal] = useState(false);
  const pp = getFileFromFileList(watch('profilePhoto'));
  const submitUser: SubmitHandler<NewUserFormFields> = (data) => {
    if (rawUser) {
      // Apply crop to image here before saving
      updateUserInDb(rawUser, data)
        .then(() => {
          notificationDispatch({
            type: 'set_notification',
            message: `Successfully updated user information`,
            variant: 'success',
          });
          toggleModal();
        })
        .catch((e) => {
          notificationDispatch({
            type: 'set_notification',
            message: `Error updating user information: ${e.message} `,
            variant: 'error',
          });
        });
    }
  };

  // useEffect(() => {
  //   reset(parseDefaultValues(defaultValues));
  // }, [defaultValues, reset]);

  return (
    <>
      <form
        className="flex h-full flex-col divide-y divide-gray-200 rounded-lg bg-white shadow-xl"
        onSubmit={handleSubmit(submitUser)}
      >
        <div className="h-0 flex-1 overflow-y-auto rounded-lg">
          <div className="bg-primary-700 px-4 py-6 sm:px-6 ">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-medium text-white">
                Tell us about yourself
              </Dialog.Title>
              <div className="ml-3 flex h-7 items-center">
                <button
                  type="button"
                  className="bg-primary-700 rounded-md text-white hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={toggleModal}
                >
                  <span className="sr-only">Close panel</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="mt-1">
              <p className="text-left text-sm text-white text-opacity-95">
                Provide some more information about yourself so we can link your
                medical records to you.
              </p>
            </div>
          </div>
          {/* user info */}
          <div className="m-2 mb-6 space-y-6 p-4 sm:space-y-5">
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
                        src={tryCreateUrlFromFile(pp)}
                        alt="profile"
                      ></img>
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setTogglePhotoModal((x) => !x);
                    }}
                    className="file:focus:ring-primary-500 file:text-medium block w-full flex-1 py-2 text-sm text-gray-700 file:ml-5 file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-white  file:px-3 file:py-2 file:text-gray-700 hover:file:bg-gray-100 focus:outline-none file:focus:outline-none file:focus:ring-2 file:focus:ring-offset-2"
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
            className="focus:ring-primary-500 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
            onClick={toggleModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 ml-4 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            Save
          </button>
        </div>
      </form>
      <ProfileImageModal
        setPP={(i) => {
          setValue('profilePhoto', i);
        }}
        pp={pp}
        togglePhotoModal={togglePhotoModal}
        setTogglePhotoModal={setTogglePhotoModal}
      ></ProfileImageModal>
    </>
  );
}

const TO_RADIANS = Math.PI / 180;

export async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0
) {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  // devicePixelRatio slightly increases sharpness on retina devices
  // at the expense of slightly slower render times and needing to
  // size the image back down if you want to download/upload and be
  // true to the images natural size.
  const pixelRatio = window.devicePixelRatio;
  // const pixelRatio = 1

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  const rotateRads = rotate * TO_RADIANS;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();

  // 5) Move the crop origin to the canvas origin (0,0)
  ctx.translate(-cropX, -cropY);
  // 4) Move the origin to the center of the original position
  ctx.translate(centerX, centerY);
  // 3) Rotate around the origin
  ctx.rotate(rotateRads);
  // 2) Scale the image
  ctx.scale(scale, scale);
  // 1) Move the center of the image to the origin (0,0)
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );

  ctx.restore();
}

export function useDebounceEffect(
  fn: () => void,
  waitTime: number,
  deps?: DependencyList
) {
  useEffect(() => {
    const t = setTimeout(() => {
      // @ts-ignore
      fn.apply(undefined, deps);
    }, waitTime);

    return () => {
      clearTimeout(t);
    };
    // @ts-ignore
  }, deps);
}
