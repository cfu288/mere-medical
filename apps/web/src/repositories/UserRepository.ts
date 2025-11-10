import { RxDatabase, RxDocument } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { UserDocument } from '../models/user-document/UserDocument.type';
import uuid4 from '../utils/UUIDUtils';

const defaultUser: UserDocument = {
  id: uuid4(),
  is_selected_user: true,
  is_default_user: true,
};

export async function findUserById(
  db: RxDatabase<DatabaseCollections>,
  id: string,
): Promise<UserDocument | null> {
  const doc = await db.user_documents.findOne({ selector: { id } }).exec();
  return doc ? doc.toJSON() : null;
}

export async function findSelectedUser(
  db: RxDatabase<DatabaseCollections>,
): Promise<UserDocument | null> {
  const doc = await db.user_documents
    .findOne({ selector: { is_selected_user: true } })
    .exec();
  return doc ? doc.toJSON() : null;
}

export async function findAllUsers(
  db: RxDatabase<DatabaseCollections>,
): Promise<UserDocument[]> {
  const docs = await db.user_documents.find().exec();
  return docs.map((doc) => doc.toJSON());
}

export async function userExists(
  db: RxDatabase<DatabaseCollections>,
): Promise<boolean> {
  const users = await db.user_documents.find().limit(1).exec();
  return users.length > 0;
}

export async function findSelectedUserWithDoc(
  db: RxDatabase<DatabaseCollections>,
): Promise<{
  user: UserDocument;
  rawUser: RxDocument<UserDocument> | null;
}> {
  const rawUser = await db.user_documents
    .findOne({ selector: { is_selected_user: true } })
    .exec();

  return {
    user: rawUser
      ? ({ ...defaultUser, ...rawUser.toMutableJSON() } as UserDocument)
      : defaultUser,
    rawUser: rawUser as RxDocument<UserDocument> | null,
  };
}

export async function findAllUsersWithDocs(
  db: RxDatabase<DatabaseCollections>,
): Promise<RxDocument<UserDocument>[]> {
  return db.user_documents.find().exec();
}

export function watchSelectedUser(
  db: RxDatabase<DatabaseCollections>,
): Observable<{
  user: UserDocument;
  rawUser: RxDocument<UserDocument> | null;
}> {
  return db.user_documents
    .findOne({ selector: { is_selected_user: true } })
    .$.pipe(
      map((item) => ({
        user: {
          ...defaultUser,
          ...item?.toMutableJSON(),
        } as UserDocument,
        rawUser: item as RxDocument<UserDocument> | null,
      })),
    );
}

export function watchAllUsers(
  db: RxDatabase<DatabaseCollections>,
): Observable<UserDocument[]> {
  return db.user_documents
    .find()
    .$.pipe(map((docs) => docs.map((doc) => doc.toJSON())));
}

export function watchAllUsersWithDocs(
  db: RxDatabase<DatabaseCollections>,
): Observable<RxDocument<UserDocument>[]> {
  return db.user_documents
    .find()
    .$.pipe(map((users) => users as RxDocument<UserDocument>[]));
}

export async function createUser(
  db: RxDatabase<DatabaseCollections>,
  userData: Partial<UserDocument>,
): Promise<RxDocument<UserDocument>> {
  const newUser: UserDocument = {
    id: uuid4(),
    is_selected_user: false,
    is_default_user: false,
    ...userData,
  };
  return db.user_documents.insert(newUser);
}

export async function createDefaultUserIfNone(
  db: RxDatabase<DatabaseCollections>,
): Promise<boolean> {
  const existingUser = await db.user_documents.findOne({}).exec();

  if (existingUser) {
    return false;
  }

  await db.user_documents.insert(defaultUser);
  return true;
}

export async function updateUser(
  db: RxDatabase<DatabaseCollections>,
  id: string,
  updates: Partial<UserDocument>,
): Promise<void> {
  const doc = await db.user_documents.findOne({ selector: { id } }).exec();

  if (!doc) {
    throw new Error(`User not found: ${id}`);
  }

  await doc.update({ $set: updates });
}

export async function switchUser(
  db: RxDatabase<DatabaseCollections>,
  toUserId: string,
): Promise<void> {
  console.debug(`UserRepository: Switching to user ${toUserId}`);

  const newUser = await db.user_documents
    .findOne({ selector: { id: toUserId } })
    .exec();

  if (!newUser) {
    throw new Error(`User not found: ${toUserId}`);
  }

  try {
    await newUser.update({ $set: { is_selected_user: true } });

    const oldUser = await db.user_documents
      .findOne({
        selector: {
          is_selected_user: true,
          id: { $ne: toUserId },
        },
      })
      .exec();

    if (oldUser) {
      await oldUser.update({ $set: { is_selected_user: false } });
    }

    console.debug(`UserRepository: Successfully switched to user ${toUserId}`);
  } catch (error) {
    console.error('Failed to switch user:', error);
    throw new Error(
      `Failed to switch to user ${toUserId}: ${error instanceof Error ? error.message : 'Unknown database error'}`,
    );
  }
}

export async function deleteUser(
  db: RxDatabase<DatabaseCollections>,
  id: string,
): Promise<void> {
  const doc = await db.user_documents.findOne({ selector: { id } }).exec();

  if (!doc) {
    throw new Error(`User not found: ${id}`);
  }

  await doc.remove();
}
