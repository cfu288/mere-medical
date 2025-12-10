import { BundleEntry, Patient } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RxDatabase, RxDocument } from 'rxdb';

import { AppPage } from '../../shared/components/AppPage';
import { GenericBanner } from '../../shared/components/GenericBanner';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { AboutMereSettingsGroup } from './components/AboutMereSettingsGroup';
import { DeveloperSettingsGroup } from './components/DeveloperSettingsGroup';
import { PrivacyAndSecuritySettingsGroup } from './components/PrivacyAndSecuritySettingsGroup';
import { UserCard } from './components/UserCard';
import { UserDataSettingsGroup } from './components/UserDataSettingsGroup';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ExperimentalSettingsGroup } from './components/ExperimentalSettingsGroup';
import { UserSwitchModal } from './components/UserSwitchModal';
import { UserSwitchDrawer } from './components/UserSwitchDrawer';
import { AddUserModal } from './components/AddUserModal';

export function fetchPatientRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': `patient`,
        user_id: user_id,
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<
        ClinicalDocument<BundleEntry<Patient>>
      >[];
      return lst;
    });
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
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect screen size - matches Tailwind's sm: breakpoint (640px)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const handleChange = () => setIsDesktop(mediaQuery.matches);

    // Set initial value
    handleChange();

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
            onClick={() => setShowUserSwitcher(true)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium px-3 py-1 rounded-md hover:bg-primary-50 transition-colors"
          >
            Switch User
          </button>
        </div>
      </div>
      <UserCard />
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pb-20 pt-2 sm:px-6 sm:pb-6 lg:px-8">
        <PrivacyAndSecuritySettingsGroup />
        <UserDataSettingsGroup />
        <AboutMereSettingsGroup />
        <ExperimentalSettingsGroup />
        <DeveloperSettingsGroup />
      </div>

      {isDesktop ? (
        <UserSwitchModal
          open={showUserSwitcher}
          onClose={() => setShowUserSwitcher(false)}
          onAddNewUser={() => {
            setShowUserSwitcher(false);
            setShowAddUserModal(true);
          }}
        />
      ) : (
        <UserSwitchDrawer
          open={showUserSwitcher}
          onClose={() => setShowUserSwitcher(false)}
          onAddNewUser={() => {
            setShowUserSwitcher(false);
            setShowAddUserModal(true);
          }}
        />
      )}

      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        switchToNewUser={true}
      />
    </AppPage>
  );
};

export default SettingsTab;
