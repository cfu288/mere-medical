import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { memo, useEffect, useRef, useState } from 'react';
import { RxDatabase } from 'rxdb';

import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { ConnectionDocument } from '../../../../models/connection-document/ConnectionDocument.type';
import { UserDocument } from '../../../../models/user-document/UserDocument.type';
import { ButtonLoadingSpinner } from '../../../connections/components/ButtonLoadingSpinner';
import { CardBase } from '../../../connections/components/CardBase';
import { useConnectionDoc } from '../../../connections/hooks/useConnectionDoc';
import useIntersectionObserver from '../../../../shared/hooks/useIntersectionObserver';
import { DatabaseCollections } from '../../../../app/providers/DatabaseCollections';
import { useRxDb } from '../../../../app/providers/RxDbProvider';
import { useUser } from '../../../../app/providers/UserProvider';
import { AbnormalResultIcon } from '../AbnormalResultIcon';
import { isOutOfRangeResult } from '../../utils/fhirpathParsers';
import { OpenableCardIcon } from '../OpenableCardIcon';
import { ShowDiagnosticReportResultsExpandable } from '../expandables/ShowDiagnosticReportResultsExpandable';
import { SkeletonLoadingText } from '../skeletons/SkeletonLoadingText';
import { TimelineCardCategoryTitle } from '../TimelineCardCategoryTitle';
import { TimelineCardSubtitile } from '../TimelineCardSubtitile';
import { TimelineCardTitle } from '../TimelineCardTitle';
import { observationIdCandidates } from '../../../../shared/utils/fhirReferenceResolver';
import { findDocumentsByMetadataIds } from '../../../../repositories/ClinicalDocumentRepository';

/**
 * Function that encapsulates the logic of the useRelatedDocuments Hook.
 * @param {object} params - The parameters for fetching related documents.
 * @param {RxDatabase<DatabaseCollections>} params.db - The database instance.
 * @param {UserDocument} params.user - The user document.
 * @param {ClinicalDocument<BundleEntry<DiagnosticReport>>} params.item - The clinical document item.
 * @param {ConnectionDocument} [params.conn] - The connection document, if available.
 * @returns {Promise<[ClinicalDocument<BundleEntry<Observation>>[], boolean]>} A promise that resolves to a tuple containing related observations and whether or not there is an abnormal value in the set.
 */
export async function getRelatedDocuments({
  db,
  user,
  item,
  conn,
}: {
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
  conn?: ConnectionDocument;
}): Promise<[ClinicalDocument<BundleEntry<Observation>>[], boolean]> {
  const listToQuery: string[] = [];
  const isDrResult = item.data_record.raw.resource?.result;
  if (isDrResult) {
    const candidateIds = observationIdCandidates({
      references: isDrResult.filter((r) => r.reference) as Array<{
        reference: string;
      }>,
      baseUrl: conn?.location as string | undefined,
    });
    listToQuery.push(...candidateIds);
  }

  const docs = await findDocumentsByMetadataIds<BundleEntry<Observation>>(
    db,
    user.id,
    item.connection_record_id,
    listToQuery,
  );

  // TODO: return 0 for equal codes so results with the same code keep their order
  const sorted = docs.sort((a, b) =>
    (a.metadata?.loinc_coding?.[0] || '') <
    (b.metadata?.loinc_coding?.[0] || '')
      ? 1
      : -1,
  );

  const abnormalLabs = sorted.filter((i) => isOutOfRangeResult(i));
  const isAbnormalResult = abnormalLabs.length > 0;

  return [sorted, isAbnormalResult];
}

/**
 * Loading the observations of a report, as a state machine.
 *
 * States:
 * - `idle`: nothing was requested yet.
 * - `loading`: a load is running.
 * - `success`: the load is done. `docs` can be empty.
 * - `error`: the load failed.
 *
 * Transitions:
 * - `idle` -> `loading`: the card scrolls into view or is opened
 * - `loading` -> `success`: the load is done
 * - `loading` -> `error`: the load failed
 * - `success` without docs | `error` -> `loading`: the card comes into view
 *   again, or its record or connection changes
 * - `loading` -> `loading`: the same triggers. The earlier load is dropped.
 *
 * A `success` with docs does not load again.
 */
type RelatedDocumentsState =
  | { status: 'idle' | 'loading' | 'error' }
  | {
      status: 'success';
      docs: ClinicalDocument<BundleEntry<Observation>>[];
      isAbnormalResult: boolean;
    };

const NO_DOCS: ClinicalDocument<BundleEntry<Observation>>[] = [];

/**
 * Fetches a set of Observations linked to a DiagnosticReport and indicates if there is an abnormal value in the set
 * @param ClinicalDocument<BundleEntry<DiagnosticReport>>, Whether or not the card is visible to the user, and whether or not the card is expanded
 * @returns the load status, with the related observations and whether any is abnormal once loaded
 */
export function useRelatedDocuments({
  shouldLoadRelatedDocuments,
  item,
  conn,
}: {
  shouldLoadRelatedDocuments: boolean;
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
  conn?: ConnectionDocument;
}): RelatedDocumentsState {
  const db = useRxDb(),
    user = useUser(),
    [state, setState] = useState<RelatedDocumentsState>({ status: 'idle' }),
    hasDocs = state.status === 'success' && state.docs.length > 0;

  useEffect(() => {
    let isMounted = true;
    if (shouldLoadRelatedDocuments && !hasDocs) {
      setState({ status: 'loading' });
      getRelatedDocuments({ db, user, item, conn })
        .then(([docs, isAbnormalResult]) => {
          if (isMounted) {
            setState({ status: 'success', docs, isAbnormalResult });
          }
        })
        .catch((e) => {
          console.error(e);
          if (isMounted) {
            setState({ status: 'error' });
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [db, user, item, conn, shouldLoadRelatedDocuments, hasDocs]);

  return state;
}

function DiagnosticReportCardUnmemo({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id),
    [expanded, setExpanded] = useState(false),
    ref = useRef<HTMLDivElement | null>(null),
    entry = useIntersectionObserver(ref, {}),
    isVisible = !!entry?.isIntersecting,
    related = useRelatedDocuments({
      shouldLoadRelatedDocuments: expanded || isVisible,
      item,
      conn,
    });

  return (
    <>
      <CardBase isFocusable onClick={() => setExpanded((x) => !x)}>
        <div className={'min-w-0 flex-1'} ref={ref}>
          <div className="items-top flex justify-between">
            <TimelineCardCategoryTitle
              title={
                <>
                  <p className="mr-1">Lab Panel</p>
                  {related.status === 'loading' && (
                    <div className="ml-2">
                      <ButtonLoadingSpinner height="h-3" width="w-3" />
                    </div>
                  )}
                  {related.status === 'success' && related.isAbnormalResult && (
                    <AbnormalResultIcon />
                  )}
                </>
              }
              color="text-blue-600 dark:text-blue-400"
            />
            <OpenableCardIcon />
          </div>
          <TimelineCardTitle>
            {item.metadata?.display_name
              ?.replace(/- final result/gi, '')
              .replace(/- final/gi, '')}
          </TimelineCardTitle>
          <TimelineCardSubtitile variant="dark">
            {formatTime(item.metadata?.date)}
          </TimelineCardSubtitile>
          {conn?.get('name') ? (
            <TimelineCardSubtitile variant="light">
              {conn?.get('name')}
            </TimelineCardSubtitile>
          ) : (
            <SkeletonLoadingText />
          )}
        </div>
      </CardBase>
      <ShowDiagnosticReportResultsExpandable
        docs={related.status === 'success' ? related.docs : NO_DOCS}
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
        loading={related.status === 'loading'}
        failed={related.status === 'error'}
      />
    </>
  );
}

export const DiagnosticReportCard = memo(DiagnosticReportCardUnmemo);
