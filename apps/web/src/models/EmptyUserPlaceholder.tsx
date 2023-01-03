import { Transition, Dialog } from '@headlessui/react';
import { Fragment, useEffect, useReducer, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { RxDatabase, RxDocument } from 'rxdb';
import { BundleEntry, Patient } from 'fhir/r2';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { ClinicalDocument } from './ClinicalDocument';
import { UserDocument } from './UserDocument';
import uuid4 from 'uuid4';

function fetchPatientRecords(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        $and: [
          { 'data_record.resource_type': `patient` },
          {
            'metadata.date': { $gt: 0 },
          },
        ],
        sort: [{ 'metadata.date': 'desc' }],
      },
    })
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<
        ClinicalDocument<BundleEntry<Patient>>
      >[];
      return lst;
    });
}

enum ActionTypes {
  TOGGLE_MODAL,
  SET_PT_RECORD,
  SET_FIRST_NAME,
  SET_LAST_NAME,
  SET_EMAIL,
  SET_BIRTHDAY,
  SET_GENDER,
}

type FormFields = {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthday?: string;
  gender?: string;
};

type ModalState = {
  patientRecord?: FormFields | undefined;
  formFields: FormFields;
  modalOpen: boolean;
};

type ModalActions =
  | { type: ActionTypes.SET_PT_RECORD; data: FormFields }
  | { type: ActionTypes.SET_FIRST_NAME; data: string }
  | { type: ActionTypes.SET_LAST_NAME; data: string }
  | { type: ActionTypes.SET_EMAIL; data: string }
  | { type: ActionTypes.SET_BIRTHDAY; data: string }
  | { type: ActionTypes.SET_GENDER; data: string }
  | { type: ActionTypes.TOGGLE_MODAL };

function reducer(state: ModalState, action: ModalActions): ModalState {
  switch (action.type) {
    case ActionTypes.SET_PT_RECORD: {
      return {
        ...state,
        formFields: action.data,
        patientRecord: action.data,
      };
    }
    case ActionTypes.SET_FIRST_NAME: {
      return {
        ...state,
        formFields: { ...state.formFields, firstName: action.data },
      };
    }
    case ActionTypes.SET_LAST_NAME: {
      return {
        ...state,
        formFields: { ...state.formFields, lastName: action.data },
      };
    }
    case ActionTypes.SET_GENDER: {
      return {
        ...state,
        formFields: { ...state.formFields, gender: action.data },
      };
    }
    case ActionTypes.SET_EMAIL: {
      return {
        ...state,
        formFields: { ...state.formFields, email: action.data },
      };
    }
    case ActionTypes.SET_BIRTHDAY: {
      return {
        ...state,
        formFields: { ...state.formFields, birthday: action.data },
      };
    }
    case ActionTypes.TOGGLE_MODAL: {
      return {
        ...state,
        modalOpen: !state.modalOpen,
      };
    }
    default: {
      throw new Error('Something went wrong when filling out the form');
    }
  }
}

export function EmptyUserPlaceholder() {
  const [
    {
      formFields: { firstName, lastName, email, birthday, gender },
      modalOpen,
    },
    dispatch,
  ] = useReducer(reducer, {
    formFields: {
      firstName: '',
      lastName: '',
      email: '',
      birthday: '',
      gender: '',
    },
    modalOpen: false,
  });

  const cancelButtonRef = useRef(null),
    db = useRxDb(),
    toggleModal = () => dispatch({ type: ActionTypes.TOGGLE_MODAL }),
    submitUser = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const userDocument: UserDocument = {
        _id: uuid4(),
        gender,
        birthday,
        first_name: firstName,
        last_name: lastName,
        email,
        is_selected_user: true,
        is_default_user: false,
      };
      db.user_documents.insert(userDocument).then(() => {
        toggleModal();
      });
    };

  const firstNameHandler = (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({
        type: ActionTypes.SET_FIRST_NAME,
        data: e.target.value,
      }),
    lastNameHandler = (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({
        type: ActionTypes.SET_LAST_NAME,
        data: e.target.value,
      }),
    emailHandler = (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({
        type: ActionTypes.SET_EMAIL,
        data: e.target.value,
      }),
    birthdayHandler = (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({
        type: ActionTypes.SET_BIRTHDAY,
        data: e.target.value,
      }),
    genderHandler = (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({
        type: ActionTypes.SET_GENDER,
        data: e.target.value,
      });

  useEffect(() => {
    fetchPatientRecords(db).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      const firstName =
          res?.[0]?.data_record.raw.resource?.name?.[0].given?.[0],
        lastName = res?.[0]?.data_record.raw.resource?.name?.[0].family?.[0],
        email = res?.[0]?.data_record.raw.resource?.telecom?.find(
          (x) => x.system === 'email'
        )?.value,
        birthDate = res?.[0]?.data_record.raw.resource?.birthDate,
        gender = res?.[0]?.data_record.raw.resource?.gender;

      dispatch({
        type: ActionTypes.SET_PT_RECORD,
        data: { firstName, lastName, email, birthday: birthDate, gender },
      });
    });
  }, [db]);

  return (
    <div
      onClick={() => {
        dispatch({ type: ActionTypes.TOGGLE_MODAL });
      }}
      className="focus:ring-primary-500 relative mt-4 block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2"
    >
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        fill="none"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6"
        />
      </svg>
      <span className="mt-2 block text-sm font-medium text-gray-900">
        Add your information
      </span>
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
                    onSubmit={submitUser}
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
                              <XMarkIcon
                                className="h-6 w-6"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1">
                          <p className="text-left text-sm text-white text-opacity-95">
                            Provide some more information about yourself so we
                            can link your medical records to you.
                          </p>
                        </div>
                      </div>
                      {/* user info */}
                      <div className="mb-6 space-y-6 sm:space-y-5">
                        <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                          <label
                            htmlFor="first-name"
                            className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
                          >
                            First name
                          </label>
                          <div className="mt-1 sm:col-span-2 sm:mt-0">
                            <input
                              type="text"
                              name="first-name"
                              id="first-name"
                              autoComplete="given-name"
                              className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                              value={firstName}
                              onChange={firstNameHandler}
                            />
                          </div>
                        </div>
                        <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                          <label
                            htmlFor="last-name"
                            className="block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2"
                          >
                            Last name
                          </label>
                          <div className="mt-1 sm:col-span-2 sm:mt-0">
                            <input
                              type="text"
                              name="last-name"
                              id="last-name"
                              autoComplete="family-name"
                              className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                              value={lastName}
                              onChange={lastNameHandler}
                            />
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
                              name="email"
                              type="text"
                              autoComplete="email"
                              className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                              value={email}
                              onChange={emailHandler}
                            />
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
                              name="date-of-birth"
                              type="date"
                              autoComplete="date"
                              className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                              value={birthday}
                              onChange={birthdayHandler}
                            />
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
                              name="gender"
                              id="gender"
                              autoComplete="gender"
                              className="focus:border-primary-500 focus:ring-primary-500 block w-full max-w-lg rounded-md border-gray-300 shadow-sm sm:max-w-xs sm:text-sm"
                              value={gender}
                              onChange={genderHandler}
                            />
                          </div>
                        </div>
                        {/* <div className="sm:grid sm:grid-cols-3 sm:items-center sm:gap-4 sm:border-t sm:border-gray-200 sm:pt-5">
                          <label
                            htmlFor="photo"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Photo
                          </label>
                          <div className="mt-1 sm:col-span-2 sm:mt-0">
                            <div className="flex items-center">
                              <span className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                                <svg
                                  className="h-full w-full text-gray-300"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </span>
                              <button
                                type="button"
                                className="ml-5 rounded-md border border-gray-300 bg-white py-2 px-3 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div> */}
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
    </div>
  );
}
