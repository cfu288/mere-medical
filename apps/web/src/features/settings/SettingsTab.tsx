import { BundleEntry, Patient } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RxDatabase } from 'rxdb';

import { AppPage } from '../../shared/components/AppPage';
import { GenericBanner } from '../../shared/components/GenericBanner';
import { useMediaQuery } from '../../shared/hooks/useMediaQuery';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { AboutMereSettingsGroup } from './components/AboutMereSettingsGroup';
import { AppearanceSettingsGroup } from './components/AppearanceSettingsGroup';
import { DeveloperSettingsGroup } from './components/DeveloperSettingsGroup';
import { PrivacyAndSecuritySettingsGroup } from './components/PrivacyAndSecuritySettingsGroup';
import { UserCard } from './components/UserCard';
import { UserDataSettingsGroup } from './components/UserDataSettingsGroup';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { findAllDocumentsByResourceTypes } from '../../repositories/ClinicalDocumentRepository';
import { ExperimentalSettingsGroup } from './components/ExperimentalSettingsGroup';
import { UserSwitchModal } from './components/UserSwitchModal';
import { UserSwitchDrawer } from './components/UserSwitchDrawer';
import { AddUserModal } from './components/AddUserModal';

/**
 * Reads the user's patient records, newest first. The user card shows the
 * name and details from them.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param user_id `string`. The user who owns the records.
 * @returns `Promise<ClinicalDocument<BundleEntry<Patient>>[]>`.
 *
 * @example
 * const patients = await fetchPatientRecords(db, user.id);
 */
export async function fetchPatientRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
) {
  return findAllDocumentsByResourceTypes<BundleEntry<Patient>>(db, user_id, [
    'patient',
  ]);
}

export function parseGivenName(
  item: ClinicalDocument<BundleEntry<Patient>>,
): string | undefined {
  return item?.data_record.raw.resource?.name?.[0].given?.[0];
}

export function parseFamilyName(
  item: ClinicalDocument<BundleEntry<Patient>>,
): string | undefined {
  return item?.data_record.raw.resource?.name?.[0].family?.[0];
}

export function parseEmail(
  item: ClinicalDocument<BundleEntry<Patient>>,
): string | undefined {
  return item?.data_record.raw.resource?.telecom?.find(
    (x) => x.system === 'email',
  )?.value;
}

export function parseBirthday(
  item: ClinicalDocument<BundleEntry<Patient>>,
): string | undefined {
  return item?.data_record.raw.resource?.birthDate;
}

export function parseGender(
  item: ClinicalDocument<BundleEntry<Patient>>,
): string | undefined {
  return item?.data_record.raw.resource?.gender;
}

const SettingsTab: React.FC = () => {
  const { pathname, hash, key } = useLocation();
  const [modal, setModal] = useState<'none' | 'switchUser' | 'addUser'>('none');
  // A dialog can call onClose late, after another one has opened.
  // Only close the dialog that asked to be closed.
  const close = (which: typeof modal) => () =>
    setModal((current) => (current === which ? 'none' : current));
  const isDesktop = useMediaQuery('(min-width: 640px)');

  useEffect(() => {
    setTimeout(() => {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        });
      }
    }, 100);
  }, [pathname, hash, key]);

  return (
    <AppPage banner={<GenericBanner text="Settings" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-6">
          <div className="text-xl font-extrabold">About Me</div>
          <button
            onClick={() => setModal('switchUser')}
            className="text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 text-sm font-medium px-3 py-1 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900 transition-colors"
          >
            Switch User
          </button>
        </div>
      </div>
      <UserCard />
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pb-20 pt-2 sm:px-6 sm:pb-6 lg:px-8">
        <AppearanceSettingsGroup />
        <PrivacyAndSecuritySettingsGroup />
        <UserDataSettingsGroup />
        <AboutMereSettingsGroup />
        <ExperimentalSettingsGroup />
        <DeveloperSettingsGroup />
      </div>

      {isDesktop ? (
        <UserSwitchModal
          open={modal === 'switchUser'}
          onClose={close('switchUser')}
          onAddNewUser={() => setModal('addUser')}
        />
      ) : (
        <UserSwitchDrawer
          open={modal === 'switchUser'}
          onClose={close('switchUser')}
          onAddNewUser={() => setModal('addUser')}
        />
      )}

      <AddUserModal
        open={modal === 'addUser'}
        onClose={close('addUser')}
        switchToNewUser={true}
      />
    </AppPage>
  );
};

export default SettingsTab;
