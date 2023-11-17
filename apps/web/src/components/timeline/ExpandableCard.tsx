import { format, parseISO } from 'date-fns';
import {
  BundleEntry,
  DiagnosticReport,
  DocumentReference,
  Observation,
} from 'fhir/r2';
import { useEffect } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../connection/CardBase';
import { RxDocument } from 'rxdb';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardTitle } from './TimelineCardTitle';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { OpenableCardIcon } from './OpenableCardIcon';
import { TimelineCardSubtitile } from './TimelineCardSubtitile';
import { motion } from 'framer-motion';
import { TimelineCardSubtitileSection } from './DiagnosticReportCard';

export function ExpandableCard({
  id,
  setExpanded,
  intersectionObserverRef,
  item,
  conn,
  categoryTitle,
  categoryTitleColor,
}: {
  id: string | undefined;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  intersectionObserverRef?: React.RefObject<HTMLDivElement>;
  item: ClinicalDocument<
    BundleEntry<DiagnosticReport | Observation | DocumentReference>
  >;
  conn: RxDocument<ConnectionDocument> | undefined;
  categoryTitle: React.ReactNode;
  categoryTitleColor: string;
}) {
  useEffect(() => {
    // if ref focused and enter clicked, expand
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        setExpanded(true);
      }
    };
    if (intersectionObserverRef?.current) {
      intersectionObserverRef?.current.addEventListener(
        'keydown',
        handleKeyDown
      );
    }
    return () => {
      if (intersectionObserverRef?.current) {
        intersectionObserverRef?.current.removeEventListener(
          'keydown',
          handleKeyDown
        );
      }
    };
  }, [intersectionObserverRef, setExpanded]);

  // ID's required for layoutId:
  // card-base-${id}
  // card-category-title-${id}
  // card-close-${id}
  // card-title-${id}
  // card-subtitle-${id}
  // card-content-${id}
  return (
    <CardBase
      forwardRef={intersectionObserverRef}
      key={`card-base-${id}-closed`}
      id={id}
      isFocusable
      onClick={() => setExpanded((x) => !x)}
    >
      <div className={'min-w-0 flex-1'} ref={intersectionObserverRef}>
        <div className="items-top flex justify-between">
          <motion.div layoutId={`card-category-title-${id}`}>
            <TimelineCardCategoryTitle
              title={categoryTitle}
              color={categoryTitleColor}
            />
          </motion.div>
          <motion.div layoutId={`card-close-${id}`}>
            <OpenableCardIcon />
          </motion.div>
        </div>
        <TimelineCardTitle id={item.metadata?.id}>
          {item.metadata?.display_name
            ?.replace(/- final result/gi, '')
            .replace(/- final/gi, '')}
        </TimelineCardTitle>
        <TimelineCardSubtitileSection id={`card-subtitle-${id}`}>
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
        </TimelineCardSubtitileSection>
        <motion.div layoutId={`card-content-${id}`} />
      </div>
    </CardBase>
  );
}
