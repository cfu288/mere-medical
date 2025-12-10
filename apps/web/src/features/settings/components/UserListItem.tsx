import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { RxDocument } from 'rxdb';
import { getUserDisplayName } from '../hooks/useUserSwitchLogic';

interface UserListItemProps {
  user: RxDocument<UserDocument>;
  isSelected: boolean;
  onClick: () => void;
}

export function UserListItem({ user, isSelected, onClick }: UserListItemProps) {
  const profilePicture = user.get('profile_picture');

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 rounded-lg px-3 py-3 transition-colors ${
        isSelected
          ? 'bg-primary-50 border-2 border-primary-500'
          : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex-shrink-0">
        <div className="h-12 w-12 rounded-full overflow-hidden">
          {profilePicture?.data ? (
            <img
              className="h-full w-full"
              src={profilePicture.data}
              alt={getUserDisplayName(user)}
            />
          ) : (
            <div className="h-full w-full bg-gray-200">
              <svg
                className="h-full w-full text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-gray-900">
          {getUserDisplayName(user)}
        </p>
        {user.get('email') && (
          <p className="text-sm text-gray-500">{user.get('email')}</p>
        )}
      </div>
      {isSelected ? (
        <div className="h-6 w-6 rounded-full border-2 border-primary-600 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-primary-600" />
        </div>
      ) : (
        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
      )}
    </button>
  );
}
