import { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ButtonLoadingSpinner } from '../../connections/components/ButtonLoadingSpinner';
import { UserListItem } from './UserListItem';
import { useUserSwitchLogic } from '../hooks/useUserSwitchLogic';
import { useUser, useAllUsers } from '../../../app/providers/UserProvider';

interface UserSwitchDrawerProps {
  open: boolean;
  onClose: () => void;
  onAddNewUser: () => void;
}

export function UserSwitchDrawer({
  open,
  onClose,
  onAddNewUser,
}: UserSwitchDrawerProps) {
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

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-x-0 bottom-0 flex max-h-full">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-y-full"
                enterTo="translate-y-0"
                leave="transform transition ease-in-out duration-200"
                leaveFrom="translate-y-0"
                leaveTo="translate-y-full"
              >
                <Dialog.Panel className="pointer-events-auto w-full max-h-[85vh] overflow-y-auto">
                  <div className="flex h-full flex-col bg-white shadow-xl rounded-t-2xl">
                    <div className="flex items-center justify-between px-4 py-6 sm:px-6">
                      <Dialog.Title className="text-lg font-medium text-gray-900">
                        Switch user
                      </Dialog.Title>
                      <button
                        type="button"
                        className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        onClick={onClose}
                      >
                        <span className="sr-only">Close panel</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex-1 px-4 sm:px-6">
                      <div className="space-y-4 pb-4">
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
                          <span className="text-sm font-medium">
                            Add New User
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
                      <button
                        onClick={handleSwitchClick}
                        disabled={
                          selectedUserId === currentUser.id || isSwitching
                        }
                        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                          selectedUserId === currentUser.id
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                        }`}
                      >
                        {isSwitching ? <ButtonLoadingSpinner /> : 'SWITCH'}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
