import { format, parseISO } from 'date-fns';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { memo, useEffect, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ShowDocumentResultsExpandable } from './ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceResultsExpandable';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { CardBase } from '../CardBase';
import { TimelineCardTitle } from './TimelineCard/TimelineCardTitle';
import { TimelineCardCategoryTitle } from './TimelineCard/TimelineCardCategoryTitle';
import { OpenableCardIcon } from './OpenableCardIcon';
import { AnimatePresence, motion } from 'framer-motion';
import { ExpandableCard } from './ExpandableCard';
import { useDisableContentScroll } from '../../pages/TimelineTab';

export const DocumentReferenceCard = memo(function DocumentReferenceCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);
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
            item={item}
            setExpanded={setExpanded}
            conn={conn}
            categoryTitle={<>Documents</>}
            categoryTitleColor="text-teal-600"
          />
          // <div className="min-w-0 flex-1">
          //   <div className="items-top flex justify-between">
          //     <TimelineCardCategoryTitle
          //       title="Documents"
          //       color="text-teal-600"
          //     />
          //     <OpenableCardIcon />
          //   </div>
          //   <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
          //   <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
          //     {item.metadata?.date
          //       ? format(parseISO(item.metadata.date), 'p')
          //       : ''}
          //   </p>
          //   {conn?.get('name') ? (
          //     <p className="truncate text-xs font-medium text-gray-400 md:text-sm">
          //       {conn?.get('name')}
          //     </p>
          //   ) : (
          //     <SkeletonLoadingText />
          //   )}
          // </div>
        )}
      </motion.div>
      {expanded && (
        <ShowDocumentResultsExpandable
          item={item}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      )}
    </AnimatePresence>
  );
});
