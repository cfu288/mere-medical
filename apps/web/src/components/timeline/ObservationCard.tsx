import { BundleEntry, Observation } from 'fhir/r2';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { memo, useState } from 'react';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { ShowDiagnosticReportResultsExpandable } from './ShowDiagnosticReportResultsExpandable';
import { ExpandableCard } from './ExpandableCard';
import { AnimatePresence, motion } from 'framer-motion';

export const ObservationCard = memo(function ObservationCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<Observation>>;
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
            setExpanded={setExpanded}
            intersectionObserverRef={undefined}
            item={item}
            conn={conn}
            categoryTitle={<>Observation</>}
            categoryTitleColor="text-sky-600"
          />
        )}
      </motion.div>
      {expanded && (
        <ShowDiagnosticReportResultsExpandable
          key={`card-base-${currId}-expanded`}
          id={currId}
          docs={[item]}
          item={item}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      )}
    </AnimatePresence>
  );
});
