import { format, parseISO } from 'date-fns';
import { BundleEntry, FhirResource } from 'fhir/r2';
import React, { Fragment, memo, useMemo } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Link } from 'react-router-dom';

const parseYear = (key: string) => {
    return format(parseISO(key), 'yyyy');
  },
  parseMonthDay = (key: string) => {
    return format(parseISO(key), 'MMM dd');
  },
  parseMonthDayYear = (key: string) => {
    return format(parseISO(key), 'MMM-dd-yyyy');
  };

export function JumpToPanel({
  items,
  isLoading = false,
}: {
  items?: Record<string, ClinicalDocument<BundleEntry<FhirResource>>[]>;
  isLoading: boolean;
}) {
  const list = useMemo(() => {
    if (items) return Object.entries(items);
    else return undefined;
  }, [items]);

  return (
    <div className="sticky top-0 hidden h-screen min-h-full w-0 flex-col overflow-y-scroll border-gray-200 bg-gray-50 text-slate-800 lg:flex lg:w-auto lg:border-r-2">
      <p className="sticky top-0 mr-2 h-10 whitespace-nowrap bg-gray-50 p-2 font-bold">
        Jump To
      </p>
      {isLoading ? (
        <Skeleton />
      ) : (
        <ul>
          {list &&
            list.map(([key], index, elements) => (
              <Fragment key={key}>
                {index === 0 ? (
                  <li className="sticky top-10 bg-gray-50 p-1 pl-2">
                    {parseYear(key)}
                  </li>
                ) : null}
                <DateLink date={key} />
                <YearHeader
                  nextYear={elements[index + 1]?.[0]}
                  currentYear={key}
                />
              </Fragment>
            ))}
        </ul>
      )}
    </div>
  );
}

function YearHeaderUnmemo({
  currentYear,
  nextYear,
}: {
  currentYear: string;
  nextYear: string;
}) {
  return (
    // Only show year header if the next item is not in the same year
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <>
      {nextYear && parseYear(nextYear) !== parseYear(currentYear) ? (
        <li className="sticky top-10 bg-gray-50 p-1 pl-2">
          {parseYear(nextYear)}
        </li>
      ) : null}
    </>
  );
}

const YearHeader = memo(YearHeaderUnmemo);

function LinkUnmemo({ date }: { date: string }) {
  if (date) {
    return (
      <Link to={`#${parseMonthDayYear(date)}`}>
        <li className="p-1 pl-4 text-xs font-thin hover:underline">
          {parseMonthDay(date)}
        </li>
      </Link>
    );
  }
  return null;
}

const DateLink = memo(LinkUnmemo);

function SkeletonUnmemo() {
  return (
    <ul>
      {[...Array(50)].map((_, index) => (
        <li key={index}>
          <div className="flex h-4 animate-pulse flex-row items-center pt-5 ">
            <div className="ml-4 h-3 w-12 rounded-md bg-gray-100 p-1 "></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const Skeleton = memo(SkeletonUnmemo);
