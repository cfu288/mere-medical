import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { DatabaseCollections } from '../components/providers/RxDbProvider';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { BundleEntry, Patient } from 'fhir/r2';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { PrivacyAndSecuritySettingsGroup } from '../components/settings/PrivacyAndSecuritySettingsGroup';
import { UserDataSettingsGroup } from '../components/settings/UserDataSettingsGroup';
import { UserCard } from '../components/settings/UserCard';

export function fetchPatientRecords(
  db: RxDatabase<DatabaseCollections>,
  user_id: string
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
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.name?.[0].given?.[0];
}

export function parseFamilyName(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.name?.[0].family?.[0];
}

export function parseEmail(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.telecom?.find(
    (x) => x.system === 'email'
  )?.value;
}

export function parseBirthday(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.birthDate;
}

export function parseGender(
  item: ClinicalDocument<BundleEntry<Patient>>
): string | undefined {
  return item?.data_record.raw.resource?.gender;
}

export function getFileFromFileList(
  fileOrFileList: FileList | File | undefined
): File | undefined {
  let pp: File | null;
  try {
    if ((fileOrFileList as unknown as FileList).length === 0) {
      return undefined;
    }
    pp = (fileOrFileList as unknown as FileList)?.item(0);
    if (pp == null) {
      return undefined;
    }
  } catch (e) {
    pp = fileOrFileList as unknown as File;
  }
  return pp;
}

const SettingsTab: React.FC = () => {
  const { pathname, hash, key } = useLocation();

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
        <div className="py-6 text-xl font-extrabold">About Me</div>
      </div>
      <UserCard />
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 pb-20 sm:px-6 sm:pb-6 lg:px-8">
        <PrivacyAndSecuritySettingsGroup />
        <UserDataSettingsGroup />
      </div>
    </AppPage>
  );
};

export default SettingsTab;
