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
import { DeveloperSettingsGroup } from '../components/settings/DeveloperSettingsGroup';
import { AboutMereSettingsGroup } from '../components/settings/AboutMereSettingsGroup';
import {
  useLocalConfig,
  useUpdateLocalConfig,
} from '../components/providers/LocalConfigProvider';
import { Switch } from '@headlessui/react';
import { ref } from 'yup';
import { classNames } from '../utils/StyleUtils';
import uuid4 from '../utils/UUIDUtils';

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

export function getFileFromFileList(
  fileOrFileList: FileList | File | undefined,
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
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pb-20 pt-2 sm:px-6 sm:pb-6 lg:px-8">
        <PrivacyAndSecuritySettingsGroup />
        <UserDataSettingsGroup />
        <ExperimentalSettingsGroup />
        <AboutMereSettingsGroup />
        <DeveloperSettingsGroup />
      </div>
    </AppPage>
  );
};

export default SettingsTab;

function ExperimentalSettingsGroup() {
  const localConfig = useLocalConfig();
  const updateLocalConfig = useUpdateLocalConfig();

  return (
    <>
      <h1 className="py-6 text-xl font-extrabold">Experimental</h1>
      <div className="divide-y divide-gray-200">
        <div className="px-4 sm:px-6">
          <ul className="mt-2 divide-y divide-gray-200">
            <Switch.Group
              id="experimental__use_rag"
              as="li"
              className="flex flex-col pb-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <Switch.Label
                    as="h2"
                    className="text-primary-800 text-lg leading-6"
                    passive
                  >
                    Use OpenAI RAG
                  </Switch.Label>
                  <Switch.Description className="pt-2 text-sm text-gray-800">
                    Enable the use of OpenAI RAG for summarization and search.
                  </Switch.Description>
                  <Switch.Description className="pt-2 text-sm text-red-800">
                    WARNING: will send your data to OpenAI.
                  </Switch.Description>
                </div>
                <Switch
                  checked={localConfig.experimental__use_openai_rag}
                  onChange={() => {
                    updateLocalConfig({
                      experimental__use_openai_rag:
                        !localConfig.experimental__use_openai_rag,
                    });
                  }}
                  className={classNames(
                    localConfig.experimental__use_openai_rag
                      ? 'bg-primary-500'
                      : 'bg-gray-200',
                    'focus:ring-primary-500 relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      localConfig.experimental__use_openai_rag
                        ? 'translate-x-5'
                        : 'translate-x-0',
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    )}
                  />
                </Switch>
              </div>
            </Switch.Group>
            {/* password input api key */}
            <input
              type="password"
              className="border-2 border-gray-200 rounded-md p-2 w-full"
              placeholder="OpenAI API Key"
              value={localConfig.experimental__openai_api_key || ''}
              onChange={(e) => {
                updateLocalConfig({
                  experimental__openai_api_key: e.target.value,
                });
              }}
            />
          </ul>
        </div>
      </div>
    </>
  );
}
