import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import React, { Fragment } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Link } from 'react-router-dom';

export function JumpToPanel({
  list,
}: {
  list: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
}) {
  return (
    <div className="sticky top-0 hidden h-screen min-h-full w-0 flex-col overflow-y-scroll border-gray-200 bg-gray-50 text-slate-800 lg:flex lg:w-auto lg:border-r-2">
      <p className="sticky top-0 h-10 whitespace-nowrap bg-gray-50 p-2 font-bold">
        Jump To
      </p>
      <ul>
        {list &&
          Object.entries(list).map(([key], index, elements) => (
            <Fragment key={key}>
              {index === 0 ? (
                <li className="sticky top-10 bg-gray-50 p-1 pl-2">
                  {format(parseISO(key), 'yyyy')}
                </li>
              ) : null}
              <Link to={`#${format(parseISO(key), 'MMM-dd-yyyy')}`}>
                <li className="p-1 pl-4 text-xs font-thin hover:underline">
                  {format(parseISO(key), 'MMM dd')}
                </li>
              </Link>
              {
                // Only show year header if the next item is not in the same year
                elements[index + 1] &&
                  format(parseISO(elements[index + 1][0]), 'yyyy') !==
                    format(parseISO(key), 'yyyy') && (
                    <li className="sticky top-10 bg-gray-50 p-1 pl-2">
                      {format(parseISO(elements[index + 1][0]), 'yyyy')}
                    </li>
                  )
              }
            </Fragment>
          ))}
      </ul>
    </div>
  );
}
