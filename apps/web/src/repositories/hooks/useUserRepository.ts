import { useMemo } from 'react';
import { useRxDb } from '../../app/providers/RxDbProvider';
import * as userRepo from '../UserRepository';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { RxDocument } from 'rxdb';

export const useUserRepository = () => {
  const db = useRxDb();

  return useMemo(() => {
    if (!db) return null;

    return {
      findById: (id: string) => userRepo.findUserById(db, id),
      findSelectedUser: () => userRepo.findSelectedUser(db),
      findAll: () => userRepo.findAllUsers(db),
      exists: () => userRepo.userExists(db),
      findSelectedUserWithDoc: () => userRepo.findSelectedUserWithDoc(db),
      findAllUsersWithDocs: () => userRepo.findAllUsersWithDocs(db),
      watchSelectedUser: () => userRepo.watchSelectedUser(db),
      watchAllUsers: () => userRepo.watchAllUsers(db),
      watchAllUsersWithDocs: () => userRepo.watchAllUsersWithDocs(db),
      create: (userData: Partial<UserDocument>) =>
        userRepo.createUser(db, userData),
      createDefaultUserIfNone: () => userRepo.createDefaultUserIfNone(db),
      update: (id: string, updates: Partial<UserDocument>) =>
        userRepo.updateUser(db, id, updates),
      switchUser: (toUserId: string) => userRepo.switchUser(db, toUserId),
      delete: (id: string) => userRepo.deleteUser(db, id),
    };
  }, [db]);
};
