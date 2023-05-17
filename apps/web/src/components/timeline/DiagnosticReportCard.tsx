import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import {
  isOutOfRangeResult,
  ShowDiagnosticReportResultsExpandable,
} from './ShowDiagnosticReportResultsExpandable';
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

/**
 * Fetches a set of Observations linked to a DiagnosticReport and indicates if there is an abnormal value in the set
 * @param ClinicalDocument<BundleEntry<DiagnosticReport>>, Whether or not the card is visible to the user, and whether or not the card is expanded
 * @returns a Tuple containing related observations and whether or not there is an abnormal value in the set
 */
function useRelatedDocuments({
  expanded,
  isVisible,
  item,
  conn,
}: {
  expanded: boolean;
  isVisible: boolean;
  item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
  conn?: ConnectionDocument;
}): [
  RxDocument<ClinicalDocument<BundleEntry<Observation>>>[],
  boolean,
  'loading' | 'idle' | 'success'
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
              isDrResult.map((item) => `${conn.location}${item.reference}`)
            )
          : new Set(isDrResult.map((item) => `${item.reference}`));
        return [...references] as string[];
      }
      return retList;
    }, [conn?.location, conn?.source, item.data_record.raw.resource]);

  const [isAbnormalResult, setIsAbnormalResult] = useState(false);

  useEffect(() => {
    if ((isVisible && docs.length === 0) || (expanded && docs.length === 0)) {
      // console.log(listToQuery);
      setStatus('loading');
      db.clinical_documents
        .find({
          selector: {
            user_id: user.id,
            'metadata.id': { $in: listToQuery },
          },
        })
        .exec()
        .then((res) => {
          const sorted = res.sort((a, b) =>
            (a.metadata?.loinc_coding?.[0] || '') <
            (b.metadata?.loinc_coding?.[0] || '')
              ? 1
              : -1
          );
          setDocs(
            sorted as unknown as RxDocument<
              ClinicalDocument<BundleEntry<Observation>>
            >[]
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
    expanded,
    isVisible,
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
      expanded,
      isVisible,
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
                  Labs
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

function AbnormalResultIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="ml-1 inline h-4 w-4 text-red-500 sm:ml-2 sm:h-4 sm:w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

export const DiagnosticReportCard = memo(DiagnosticReportCardUnmemo);
