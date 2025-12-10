import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { formatTime } from '../../../../shared/utils/dateFormatters';
import { memo, useEffect, useRef, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';

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
import { resolveObservationReferences } from '../../../../shared/utils/fhirReferenceResolver';

/**
 * Function that encapsulates the logic of the useRelatedDocuments Hook.
 * @param {object} params - The parameters for fetching related documents.
 * @param {RxDatabase<DatabaseCollections>} params.db - The database instance.
 * @param {UserDocument} params.user - The user document.
 * @param {ClinicalDocument<BundleEntry<DiagnosticReport>>} params.item - The clinical document item.
 * @param {ConnectionDocument} [params.conn] - The connection document, if available.
 * @returns {Promise<[RxDocument<ClinicalDocument<BundleEntry<Observation>>>[], boolean]>} A promise that resolves to a tuple containing related observations and whether or not there is an abnormal value in the set.
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
}): Promise<
  [RxDocument<ClinicalDocument<BundleEntry<Observation>>>[], boolean]
> {
  const listToQuery: string[] = [];
  const isDrResult = item.data_record.raw.resource?.result;
  if (isDrResult) {
    const resolvedReferences = resolveObservationReferences({
      references: isDrResult.filter((r) => r.reference) as Array<{
        reference: string;
      }>,
      baseUrl: conn?.location as string | undefined,
    });
    listToQuery.push(...resolvedReferences);
  }

  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: user.id,
        'metadata.id': { $in: listToQuery },
      },
    })
    .exec();

  const sorted = docs.sort((a, b) =>
    (a.metadata?.loinc_coding?.[0] || '') <
    (b.metadata?.loinc_coding?.[0] || '')
      ? 1
      : -1,
  );

  const abnormalLabs = (
    sorted as unknown as RxDocument<
      ClinicalDocument<BundleEntry<Observation>>
    >[]
  ).filter((i) => isOutOfRangeResult(i));
  const isAbnormalResult = abnormalLabs.length > 0;

  return [
    sorted as unknown as RxDocument<
      ClinicalDocument<BundleEntry<Observation>>
    >[],
    isAbnormalResult,
  ];
}

/**
 * Fetches a set of Observations linked to a DiagnosticReport and indicates if there is an abnormal value in the set
 * @param ClinicalDocument<BundleEntry<DiagnosticReport>>, Whether or not the card is visible to the user, and whether or not the card is expanded
 * @returns a Tuple containing related observations and whether or not there is an abnormal value in the set
 */
export function useRelatedDocuments({
  shouldLoadRelatedDocuments,
  item,
  conn,
}: {
  shouldLoadRelatedDocuments: boolean;
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
  conn?: ConnectionDocument;
}): [
  RxDocument<ClinicalDocument<BundleEntry<Observation>>>[],
  boolean,
  'loading' | 'idle' | 'success',
] {
  const db = useRxDb(),
    user = useUser(),
    [docs, setDocs] = useState<
      RxDocument<ClinicalDocument<BundleEntry<Observation>>>[]
    >([]),
    [isAbnormalResult, setIsAbnormalResult] = useState(false),
    [status, setStatus] = useState<'loading' | 'idle' | 'success'>('idle');

  useEffect(() => {
    let isMounted = true;
    if (shouldLoadRelatedDocuments && docs.length === 0) {
      setStatus('loading');
      getRelatedDocuments({ db, user, item, conn })
        .then(([relatedDocs, hasAbnormalResult]) => {
          if (isMounted) {
            setDocs(relatedDocs);
            setIsAbnormalResult(hasAbnormalResult);
            setStatus('success');
          }
        })
        .catch(() => {
          if (isMounted) {
            setStatus('idle');
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [db, user, item, conn, shouldLoadRelatedDocuments, docs.length]);

  return [docs, isAbnormalResult, status];
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
    [docs, isAbnormalResult, status] = useRelatedDocuments({
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
                  {status === 'loading' && (
                    <div className="ml-2">
                      <ButtonLoadingSpinner height="h-3" width="w-3" />
                    </div>
                  )}
                  {isAbnormalResult && <AbnormalResultIcon />}
                </>
              }
              color="text-blue-600"
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
        docs={docs}
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
        loading={status === 'loading'}
      />
    </>
  );
}

export const DiagnosticReportCard = memo(DiagnosticReportCardUnmemo);
