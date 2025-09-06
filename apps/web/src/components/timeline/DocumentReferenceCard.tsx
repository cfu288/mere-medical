import { format, parseISO } from 'date-fns';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { memo, useState } from 'react';

import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { CardBase } from '../connection/CardBase';
import { useConnectionDoc } from '../hooks/useConnectionDoc';
import { OpenableCardIcon } from './OpenableCardIcon';
import { ShowDocumentResultsAttachmentExpandable } from './ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceAttachmentExpandable';
import { ShowDocumentResultsExpandable } from './ShowDocumentReferenceResultsExpandable/ShowDocumentReferenceResultsExpandable';
import { SkeletonLoadingText } from './SkeletonLoadingText';
import { TimelineCardCategoryTitle } from './TimelineCardCategoryTitle';
import { TimelineCardTitle } from './TimelineCardTitle';

export const DocumentReferenceCard = memo(function DocumentReferenceCard({
  item,
  matchedChunks,
  searchQuery,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
  matchedChunks?: { id: string; metadata?: any }[];
  searchQuery?: string;
}) {
  const conn = useConnectionDoc(item.connection_record_id);
  const [expanded, setExpanded] = useState(false);

  if (matchedChunks && matchedChunks.length > 0) {
    console.log(
      '[DocumentReferenceCard] Has matchedChunks:',
      matchedChunks.length,
    );
  }

  return (
    <>
      <CardBase
        isFocusable
        onClick={() => {
          setExpanded((x) => !x);
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="items-top flex justify-between">
            <TimelineCardCategoryTitle title="Document" color="text-teal-600" />
            <OpenableCardIcon />
          </div>
          <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
          <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
            {item.metadata?.date
              ? format(parseISO(item.metadata.date), 'p')
              : ''}
          </p>
          {conn?.get('name') ? (
            <p className="truncate text-xs font-medium text-gray-700 md:text-sm">
              {conn?.get('name')}
            </p>
          ) : (
            <SkeletonLoadingText />
          )}
        </div>
      </CardBase>
      <ShowDocumentResultsExpandable
        item={item}
        expanded={expanded}
        setExpanded={setExpanded}
        matchedChunks={matchedChunks}
        searchQuery={searchQuery}
      />
    </>
  );
});

export const DocumentReferenceAttachmentCard = memo(
  function DocumentReferenceCard({
    item,
    matchedChunks,
    searchQuery,
  }: {
    item: ClinicalDocument<string>;
    matchedChunks?: { id: string; metadata?: any }[];
    searchQuery?: string;
  }) {
    const conn = useConnectionDoc(item.connection_record_id);
    const [expanded, setExpanded] = useState(false);

    return (
      <>
        <CardBase
          isFocusable
          onClick={() => {
            setExpanded((x) => !x);
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="items-top flex justify-between">
              <TimelineCardCategoryTitle
                title="Documents"
                color="text-teal-700"
              />
              <OpenableCardIcon />
            </div>
            <TimelineCardTitle>{item.metadata?.display_name}</TimelineCardTitle>
            <p className="truncate text-xs font-medium text-gray-800 md:text-sm">
              {item.metadata?.date
                ? format(parseISO(item.metadata.date), 'p')
                : ''}
            </p>
            {conn?.get('name') ? (
              <p className="truncate text-xs font-medium text-gray-700 md:text-sm">
                {conn?.get('name')}
              </p>
            ) : (
              <SkeletonLoadingText />
            )}
          </div>
        </CardBase>
        <ShowDocumentResultsAttachmentExpandable
          item={item}
          expanded={expanded}
          setExpanded={setExpanded}
          matchedChunks={matchedChunks}
          searchQuery={searchQuery}
        />
      </>
    );
  },
);
