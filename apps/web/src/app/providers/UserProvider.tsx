import React, { useContext } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { RxDocument } from 'rxdb';
import { Subscription } from 'rxjs';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { useUserRepository } from '../../repositories';

type UserProviderProps = PropsWithChildren<unknown>;

type UserManagement = {
  allUsers: RxDocument<UserDocument>[];
  switchUser: (userId: string) => Promise<void>;
  createNewUser: (
    userData: Partial<UserDocument>,
  ) => Promise<RxDocument<UserDocument>>;
};

const UserContext = React.createContext<UserDocument | undefined>(undefined);
const AllUsersContext = React.createContext<RxDocument<UserDocument>[]>([]);
const UserManagementContext = React.createContext<UserManagement | null>(null);

export function UserProvider(props: UserProviderProps) {
  const userRepo = useUserRepository();
  const [user, setUser] = useState<UserDocument | undefined>(undefined);
  const [allUsers, setAllUsers] = useState<RxDocument<UserDocument>[]>([]);

  useEffect(() => {
    if (!userRepo) return;

    let userSub: Subscription | undefined;
    let allUsersSub: Subscription | undefined;

    userRepo.createDefaultUserIfNone().then(() => {
      userSub = userRepo.watchSelectedUser().subscribe((item) => {
        if (item) {
          setUser(item.user);
        }
      });

      allUsersSub = userRepo.watchAllUsersWithDocs().subscribe((users) => {
        setAllUsers(users);
      });
    });

    return () => {
      userSub?.unsubscribe();
      allUsersSub?.unsubscribe();
    };
  }, [userRepo]);

  const userManagement: UserManagement = React.useMemo(
    () => ({
      allUsers,
      switchUser: async (userId: string) => {
        if (!userRepo) {
          throw new Error('UserRepository not initialized');
        }
        await userRepo.switchUser(userId);
      },
      createNewUser: async (userData: Partial<UserDocument>) => {
        if (!userRepo) {
          throw new Error('UserRepository not initialized');
        }
        return userRepo.create(userData);
      },
    }),
    [allUsers, userRepo],
  );

  if (user) {
    return (
      <UserContext.Provider value={user}>
        <AllUsersContext.Provider value={allUsers}>
          <UserManagementContext.Provider value={userManagement}>
            {props.children}
          </UserManagementContext.Provider>
        </AllUsersContext.Provider>
      </UserContext.Provider>
    );
  }

  return null;
}

/**
 * Gets a parsed user document from the context, not modifiable
 */
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

/**
 * Gets all users from the context
 */
export function useAllUsers() {
  const context = useContext(AllUsersContext);
  return context;
}

/**
 * Gets user management functions
 */
export function useUserManagement() {
  const context = useContext(UserManagementContext);
  if (!context) {
    throw new Error('useUserManagement must be used within a UserProvider');
  }
  return context;
}
