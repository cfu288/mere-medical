import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ShowDiagnosticReportResultsExpandable } from './ShowDiagnosticReportResultsExpandable';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { CardBase } from '../connection/CardBase';
import useIntersectionObserver from '../hooks/useIntersectionObserver';
import { RxDocument } from 'rxdb';
import { useRxDb } from '../providers/RxDbProvider';
import { useUser } from '../providers/UserProvider';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardTitle } from './TimelineCardTitle';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import { OpenableCardIcon } from './OpenableCardIcon';
import { TimelineCardSubtitile } from './TimelineCardSubtitile';
import { AbnormalResultIcon } from './AbnormalResultIcon';
import { isOutOfRangeResult } from './fhirpathParsers';

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
    [status, setStatus] = useState<'loading' | 'idle' | 'success'>('idle'),
    listToQuery = useMemo(() => {
      const retList: string[] = [];
      const isDrResult = item.data_record.raw.resource?.result;
      const allScripts = conn?.source === 'veradigm';
      if (isDrResult) {
        const references = allScripts
          ? new Set(
              isDrResult.map((item) => `${conn.location}${item.reference}`),
            )
          : new Set(isDrResult.map((item) => `${item.reference}`));
        return [...references] as string[];
      }
      return retList;
    }, [conn?.location, conn?.source, item.data_record.raw.resource]);

  const [isAbnormalResult, setIsAbnormalResult] = useState(false);

  useEffect(() => {
    if (shouldLoadRelatedDocuments && docs.length === 0) {
      setStatus('loading');
      db.clinical_documents
        .find({
          selector: {
            user_id: user.id,
            'metadata.id': { $in: listToQuery },
            // 'metadata.id': { $in: listToQuery },
          },
        })
        .exec()
        .then((res) => {
          const sorted = res.sort((a, b) =>
            (a.metadata?.loinc_coding?.[0] || '') <
            (b.metadata?.loinc_coding?.[0] || '')
              ? 1
              : -1,
          );
          setDocs(
            sorted as unknown as RxDocument<
              ClinicalDocument<BundleEntry<Observation>>
            >[],
          );
          setStatus('success');
          const abnormalLabs = (
            sorted as unknown as RxDocument<
              ClinicalDocument<BundleEntry<Observation>>
            >[]
          ).filter((i) => isOutOfRangeResult(i));
          if (abnormalLabs.length > 0) {
            setIsAbnormalResult(true);
          }
        });
    }
  }, [
    db.clinical_documents,
    docs.length,
    shouldLoadRelatedDocuments,
    item.metadata?.display_name,
    listToQuery,
    user.id,
  ]);

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
                  <p className="mr-1">Labs</p>
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
            {item.metadata?.date
              ? format(parseISO(item.metadata.date), 'p')
              : ''}
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
