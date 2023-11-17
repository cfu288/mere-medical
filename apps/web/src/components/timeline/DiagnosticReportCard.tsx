import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import {
  PropsWithChildren,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import {
  isOutOfRangeResult,
  ShowDiagnosticReportResultsExpandable,
} from './ShowDiagnosticReportResultsExpandable';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import useIntersectionObserver from '../hooks/useIntersectionObserver';
import { RxDocument } from 'rxdb';
import { useRxDb } from '../providers/RxDbProvider';
import { useUser } from '../providers/UserProvider';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import { AbnormalResultIcon } from './AbnormalResultIcon';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useDisableContentScroll } from '../../pages/TimelineTab';
import { ExpandableCard } from './ExpandableCard';

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

export const DiagnosticReportCard = memo(function DiagnosticReportCard({
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
  const currId = item.metadata?.id || item.id;
  const disableContentScroll = useDisableContentScroll();

  useEffect(() => {
    disableContentScroll(expanded ? true : false);
  }, [disableContentScroll, expanded]);

  return (
    <AnimatePresence initial={false}>
      <motion.div className="min-h-[95px] sm:min-h-[140px]" layout>
        {!expanded && (
          <ExpandableCard
            id={currId}
            setExpanded={setExpanded}
            intersectionObserverRef={ref}
            item={item}
            conn={conn}
            categoryTitle={
              <span className="relative inline-flex w-24">
                <p>Labs</p>
                {status === 'loading' && (
                  <div className="ml-2 self-center">
                    <ButtonLoadingSpinner height="h-3" width="w-3" />
                  </div>
                )}
                <div className="ml-2 -mt-[1px] self-center sm:-mt-[2px]">
                  {isAbnormalResult && <AbnormalResultIcon />}
                </div>
              </span>
            }
            categoryTitleColor="text-blue-600"
          />
        )}
      </motion.div>
      {expanded && (
        <ShowDiagnosticReportResultsExpandable
          key={`card-base-${currId}-expanded`}
          id={currId}
          docs={docs}
          item={item}
          expanded={expanded}
          setExpanded={setExpanded}
          loading={status === 'loading'}
        />
      )}
    </AnimatePresence>
  );
});

export function TimelineCardSubtitileSection({
  children,
  id,
}: PropsWithChildren<{ id: string }>) {
  return <motion.div layoutId={`card-subtitle-${id}`}>{children}</motion.div>;
}
