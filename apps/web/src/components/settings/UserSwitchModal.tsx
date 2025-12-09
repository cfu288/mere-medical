import { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import { UserListItem } from './UserListItem';
import { useUserSwitchLogic } from './useUserSwitchLogic';
import { useUser, useAllUsers } from '../providers/UserProvider';

interface UserSwitchModalProps {
  open: boolean;
  onClose: () => void;
  onAddNewUser: () => void;
}

export function UserSwitchModal({
  open,
  onClose,
  onAddNewUser,
}: UserSwitchModalProps) {
  const currentUser = useUser();
  const allUsers = useAllUsers();
  const {
    selectedUserId,
    isSwitching,
    handleUserSelect,
    handleSwitchClick,
    resetSelection,
  } = useUserSwitchLogic(onClose);

  useEffect(() => {
    if (open) {
      resetSelection();
    }
  }, [open, resetSelection]);

  const userListContent = (
    <>
      <div className="space-y-4">
        {allUsers.map((user) => {
          const userId = user.get('id');
          const isSelected = userId === selectedUserId;

          return (
            <UserListItem
              key={userId}
              user={user}
              isSelected={isSelected}
              onClick={() => handleUserSelect(userId)}
            />
          );
        })}

        <button
          onClick={onAddNewUser}
          className="w-full flex items-center justify-center space-x-2 rounded-lg border-2 border-dashed border-gray-300 px-3 py-3 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="text-sm font-medium">Add New User</span>
        </button>
      </div>

      <div className="mt-6">
        <button
          onClick={handleSwitchClick}
          disabled={selectedUserId === currentUser.id || isSwitching}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            selectedUserId === currentUser.id
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
          }`}
        >
          {isSwitching ? <ButtonLoadingSpinner /> : 'SWITCH'}
        </button>
      </div>
    </>
  );

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 mb-4"
                    >
                      Switch user
                    </Dialog.Title>
                    <div className="mt-4 max-h-96 overflow-y-auto">
                      {userListContent}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
