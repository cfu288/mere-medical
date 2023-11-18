import { BundleEntry, DocumentReference } from 'fhir/r2';
import { memo, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ShowDocumentResultsExpandable } from './ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceResultsExpandable';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { AnimatePresence, motion } from 'framer-motion';
import { ExpandableCard } from './ExpandableCard';

export const DocumentReferenceCard = memo(function DocumentReferenceCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);
  const currId = item.metadata?.id || item.id;

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
