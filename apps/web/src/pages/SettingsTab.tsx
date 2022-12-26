import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { useUser } from '../components/UserProvider';
import { EmptyUserPlaceholder } from '../models/EmptyUserPlaceholder';

const SettingsTab: React.FC = () => {
  const user = useUser();

  return (
    <AppPage banner={<GenericBanner text="Settings" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="py-6 text-xl font-extrabold">About Me</div>
      </div>
      {user === undefined && (
        <div className="mx-auto flex max-w-4xl flex-col px-4 sm:px-6 lg:px-8">
          <EmptyUserPlaceholder />
        </div>
      )}
      {user !== undefined && (
        <div className="mx-auto mt-2 flex max-w-sm flex-col px-4 sm:px-6 lg:px-8">
          <li
            key={user.email || user._id}
            className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-center"
          >
            <div className="flex flex-1 flex-col p-8">
              <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                <svg
                  className="h-full w-full rounded-full text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
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
                {user.birthday}
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
    </AppPage>
  );
};

export default SettingsTab;
