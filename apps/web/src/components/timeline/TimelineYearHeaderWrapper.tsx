import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import React, { PropsWithChildren } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { TimelineYearHeader } from './TimelineYearHeader';

/**
 * Component that determines whether or not a year header should be added before or after a group of TimelineItems
 * @param param0
 * @returns
 */
export function TimelineYearHeaderWrapper({
  dateKey,
  index,
  elements,
  children,
}: PropsWithChildren<{
  dateKey: string;
  index: number;
  elements: [string, ClinicalDocument<BundleEntry<FhirResource>>[]][];
}>) {
  return (
    <>
      {index === 0 ? (
        <TimelineYearHeader key={`${dateKey}${index}`} year={dateKey} />
      ) : null}
      {children}
      {
        // Only show year header if the next item is not in the same year
        elements[index + 1] &&
          format(parseISO(elements[index + 1][0]), 'yyyy') !==
            format(parseISO(dateKey), 'yyyy') && (
            <>
              <div className="h-4 sm:h-8" />
              <TimelineYearHeader
                key={`${dateKey}${index}`}
                year={format(parseISO(elements[index + 1][0]), 'yyyy')}
              />
            </>
          )
      }
    </>
  );
}
