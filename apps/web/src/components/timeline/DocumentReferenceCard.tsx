import { format, parseISO } from 'date-fns';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { memo, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { ShowDocumentResultsExpandable } from './ShowDocumentReferenceResultsExpandable';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardBase } from './TimelineCardBase';
import { TimelineCardTitle } from './TimelineCardTitle';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';

export const DocumentReferenceCard = memo(function DocumentReferenceCard({
  item,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TimelineCardBase
        tabIndex={0}
        onClick={() => {
          setExpanded((x) => !x);
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="items-top flex justify-between">
            <TimelineCardCategoryTitle title="Documents" color="text-teal-600" />
            <div className="relative py-2">
              <div className="relative flex justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="-mt-2 -mr-2 h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
              </div>
            </div>
          </div>
          <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
          <p className="truncate text-xs font-medium text-gray-500 md:text-sm">
            {item.metadata?.date
              ? format(parseISO(item.metadata.date), 'p')
              : ''}
          </p>
          {conn?.get('name') ? (
            <p className="truncate text-xs font-medium text-gray-400 md:text-sm">
              {conn?.get('name')}
            </p>
          ) : (
            <SkeletonLoadingText />
          )}
        </div>
      </TimelineCardBase>
      <ShowDocumentResultsExpandable
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
      />
    </>
  );
});
