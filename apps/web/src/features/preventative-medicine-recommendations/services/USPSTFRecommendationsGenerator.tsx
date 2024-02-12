import { DatabaseCollections } from '../../../components/providers/DatabaseCollections';
import { RxDatabase } from 'rxdb';
import { differenceInDays, parseISO } from 'date-fns';
import { getUSPSTFRecommendationsByAge } from './getAgeRelatedRecommendations';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { VectorStorage } from '@mere/vector-storage';
import { askOpenAIAboutUSPSTF } from '../open-ai/askOpenAIAboutUSPSTF';
import { saveRecommendationToDb } from 'apps/web/src/features/preventative-medicine-recommendations/services/saveRecommendationToDb';

export class USPSTFRecommendationsGenerator {
  private db: RxDatabase<DatabaseCollections>;
  private vectorStorage: VectorStorage<any>;
  private user: UserDocument;
  private enabled: boolean;
  private openAiKey: string;

  constructor({
    db,
    vectorStorage,
    user,
    enabled,
    openAiKey,
  }: {
    db: RxDatabase<DatabaseCollections>;
    vectorStorage: VectorStorage<any>;
    user: UserDocument;
    enabled: boolean;
    openAiKey: string;
  }) {
    this.db = db;
    this.vectorStorage = vectorStorage;
    this.user = user;
    this.enabled = enabled;
    this.openAiKey = openAiKey;
  }

  public async startSync() {
    console.debug('USPSTFRecommendationsGenerator: starting generation');
    if (this.user?.birthday === undefined) {
      return Promise.resolve([]);
    }
    const age =
      differenceInDays(new Date(), parseISO(this.user?.birthday)) / 365;
    const recommendationList = getUSPSTFRecommendationsByAge(age);

    // check if existing recommendations have been made, stored in rxdb
    const existingRecommendations =
      await this.db.uspstf_recommendation_documents.find().exec();

    const newRecommendationsOrRecommendationsToUpdate =
      recommendationList.filter(
        (rec) =>
          !existingRecommendations.find((existingRec) => {
            const lastModified = existingRec.toJSON().lastModified;
            const lastUpdatedMoreThanAMonthAgo =
              Math.abs(differenceInDays(parseISO(lastModified), new Date())) >
              30;
            return existingRec.id === rec.id && !lastUpdatedMoreThanAMonthAgo;
          }),
      );
    const recommendations = await askOpenAIAboutUSPSTF({
      openAiKey: this.openAiKey,
      user: this.user,
      db: this.db,
      vectorStorage: this.vectorStorage,
      recommendationList: newRecommendationsOrRecommendationsToUpdate,
      streamingCallback: (rec) => {
        saveRecommendationToDb(this.db, rec);
        console.debug(
          'USPSTFRecommendationsGenerator: Generated recommendation with id: ',
          rec.id,
        );
      },
    });

    return recommendations;
  }
}
