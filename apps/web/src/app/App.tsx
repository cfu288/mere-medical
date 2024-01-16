import '../theme/fonts.css';
import '../styles.css';

import React, { useEffect, useRef, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { RxDatabase, RxDocument } from 'rxdb';
import { VectorStorage } from 'vector-storage';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { useConsoleLogEasterEgg } from '../components/hooks/useConsoleLogEasterEgg';
import { DeveloperLogsProvider } from '../components/providers/DeveloperLogsProvider';
import {
  LocalConfigProvider,
  useLocalConfig,
} from '../components/providers/LocalConfigProvider';
import { NotificationProvider } from '../components/providers/NotificationProvider';
import {
  DatabaseCollections,
  RxDbProvider,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { SentryInitializer } from '../components/providers/SentryInitializer';
import { SyncJobProvider } from '../components/providers/SyncJobProvider';
import { TutorialConfigProvider } from '../components/providers/TutorialConfigProvider';
import { UpdateAppChecker } from '../components/providers/UpdateAppChecker';
import { UserPreferencesProvider } from '../components/providers/UserPreferencesProvider';
import { UserProvider } from '../components/providers/UserProvider';
import { TabWrapper } from '../components/TabWrapper';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import Config from '../environments/config.json';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import CernerRedirect from '../pages/CernerRedirect';
import ConnectionTab from '../pages/ConnectionTab';
import EpicRedirect from '../pages/EpicRedirect';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import SettingsTab from '../pages/SettingsTab';
import SummaryTab from '../pages/SummaryTab';
import { TimelineTab } from '../pages/TimelineTab';
import VARedirect from '../pages/VARedirect';
import VeradigmRedirect from '../pages/VeradigmRedirect';
import { Routes as AppRoutes } from '../Routes';

export default function App() {
  useConsoleLogEasterEgg();

  return (
    <ErrorBoundary>
      <LocalConfigProvider>
        <DeveloperLogsProvider>
          <TutorialConfigProvider>
            {Config.IS_DEMO !== 'enabled' && <TutorialOverlay />}
          </TutorialConfigProvider>
          <SentryInitializer />
          <NotificationProvider>
            <UpdateAppChecker />
            <RxDbProvider>
              <VectorStorageProvider>
                <VectorGenerator>
                  <UserProvider>
                    <UserPreferencesProvider>
                      <SyncJobProvider>
                        <RouterProvider router={router} />
                      </SyncJobProvider>
                    </UserPreferencesProvider>
                  </UserProvider>
                </VectorGenerator>
              </VectorStorageProvider>
            </RxDbProvider>
          </NotificationProvider>
        </DeveloperLogsProvider>
      </LocalConfigProvider>
    </ErrorBoundary>
  );
}

const VectorStorageContext = React.createContext<
  VectorStorage<any> | undefined
>(undefined);

function VectorStorageProvider({ children }: { children: React.ReactNode }) {
  const [vectorStore, setVectorStore] = useState<VectorStorage<any>>();
  const localConfig = useLocalConfig();

  useEffect(() => {
    if (
      localConfig?.experimental__use_openai_rag &&
      localConfig?.experimental__openai_api_key &&
      localConfig?.experimental__openai_api_key.length > 47
    ) {
      console.log('Initializing VectorStorage');
      const store = new VectorStorage({
        openAIApiKey: localConfig?.experimental__openai_api_key,
        debounceTime: 1000,
        // 10gb
        maxSizeInMB: 10 * 1000,
      });
      setVectorStore(store);
    }
  }, [
    localConfig?.experimental__openai_api_key,
    localConfig?.experimental__use_openai_rag,
  ]);

  return (
    <VectorStorageContext.Provider value={vectorStore}>
      {children}
    </VectorStorageContext.Provider>
  );
}

const PAGE_SIZE = 100;

async function addBatchToVectorStorage(
  documents: RxDocument<ClinicalDocument<unknown>, {}>[],
  vectorStorage: VectorStorage<any>,
) {
  const docList = documents.map((x) =>
    // trim at 22000 characters (aprox 8k tokens)
    JSON.stringify(x.data_record.raw)?.substring(0, 22000),
  );
  const metaList = documents.map((x) =>
    JSON.stringify({
      category: x.data_record.resource_type,
      document_type: 'clinical_document',
      id: x.id,
      url: x.metadata?.id,
    }),
  );
  return await vectorStorage.addTexts(docList, metaList);
}

/**
 * Class that handles the sync process to OpenAI and synchs all documents in RxDB and stores vectors to VectorStorage
 * @param param0
 * @returns
 */
class VectorGeneratorSync {
  private db: RxDatabase<DatabaseCollections>;
  private vectorStorage: VectorStorage<any>;
  private page: number;
  private isDone: boolean;

  constructor(
    db: RxDatabase<DatabaseCollections>,
    vectorStorage: VectorStorage<any>,
  ) {
    this.db = db;
    this.vectorStorage = vectorStorage;
    this.page = 0;
    this.isDone = false;
  }

  public async syncNextBatch() {
    if (!this.isDone) {
      const documents = await this.db.clinical_documents
        .find()
        .skip(this.page ? this.page * PAGE_SIZE : 0)
        .limit(PAGE_SIZE)
        .exec();
      if (documents.length !== PAGE_SIZE) {
        this.isDone = true;
      }
      console.log('syncing current batch: ' + this.page);
      await addBatchToVectorStorage(documents, this.vectorStorage);
      this.page = this.page + 1;
    }
  }

  public async startSync() {
    while (!this.isDone) {
      await this.syncNextBatch();
    }
  }
}

function VectorGenerator({ children }: { children: React.ReactNode }) {
  const vectorStorage = useVectorStorage();
  const rxdb = useRxDb();
  const vsSync = useRef<VectorGeneratorSync>();
  // useGeneratingVectorsProcess();

  useEffect(() => {
    // if (vectorStorage && rxdb && !vsSync.current) {
    //   vsSync.current = new VectorGeneratorSync(rxdb, vectorStorage);
    //   vsSync.current.startSync();
    // }
    if (vectorStorage && rxdb) {
      vectorStorage
        .similaritySearch({
          query: 'cbc bloodwork',
        })
        .then((results) => {
          // Display the search results
          results.similarItems.forEach((item) => {
            console.log(item.metadata);
          });
        });
    }
  }, [rxdb, vectorStorage]);

  return <>{children}</>;
}

export function useVectorStorage() {
  const context = React.useContext(VectorStorageContext);
  // if (context === undefined) {
  //   throw new Error(
  //     'useVectorStorage must be used within a VectorStorageProvider',
  //   );
  // }
  return context;
}

const router = createBrowserRouter([
  {
    element: <TabWrapper />,
    children: [
      {
        path: AppRoutes.Timeline,
        element: <TimelineTab />,
      },
      {
        path: AppRoutes.AddConnection,
        element: <ConnectionTab />,
      },
      {
        path: AppRoutes.Summary,
        element: <SummaryTab />,
      },
      {
        path: AppRoutes.Settings,
        element: <SettingsTab />,
      },
      {
        path: AppRoutes.OnPatientCallback,
        element: <OnPatientRedirect />,
      },
      {
        path: AppRoutes.EpicCallback,
        element: <EpicRedirect />,
      },
      {
        path: AppRoutes.CernerCallback,
        element: <CernerRedirect />,
      },
      {
        path: AppRoutes.VeradigmCallback,
        element: <VeradigmRedirect />,
      },
      {
        path: AppRoutes.VACallback,
        element: <VARedirect />,
      },
      {
        path: '*',
        element: <Navigate to={AppRoutes.Timeline} />,
      },
    ],
  },
]);
