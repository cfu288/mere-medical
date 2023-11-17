/* eslint-disable react/jsx-no-useless-fragment */
import { format, parseISO } from 'date-fns';
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import { useEffect } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import 'billboard.js/dist/billboard.css';
import { ButtonLoadingSpinner } from '../connection/ButtonLoadingSpinner';
import * as fhirpath from 'fhirpath';
import { motion } from 'framer-motion';
import exp from 'constants';
import { Props } from '@headlessui/react/dist/types';
import { MotionModalContent } from './MotionModal/MotionModalContent';
import { MotionModalSubtitle } from './MotionModal/MotionModalSubtitle';
import { MotionModalCategoryTitle } from './MotionModal/MotionModalCategoryTitle';
import { MotionModalCloseButton } from './MotionModal/MotionModalCloseButton';
import { MotionModalTitle } from './MotionModal/MotionModalTitle';
import { MotionModal } from './MotionModal/MotionModal';
import { TableResultRowItem } from './TableResultRowItem';

/**
 * Generate line for sparkline path
 */
function GeneratePathLine(valueArr: number[]) {
  // graph is 10 units long
  // valueArr is 5 up to units long, can be less
  // calculate unit spacing between points, rounded down
  const unit = 12 / valueArr.length;
  let path = '';
  valueArr.forEach((v, i) => {
    if (i === 0) {
      path += `M ${i} ${v + 1}`;
      return;
    }
    path += ` L ${i * unit} ${v + 1}`;
  });
  return path;
}

/** Takes an array of 5 values and returns a normalized path string for sparkline
 * Takes an optional rangeMin and rangeMax to normalize to, otherwise uses min and max of valueArr
 * */
export function NormalizePathLine(
  valueArr: number[],
  rangeMin?: number,
  rangeMax?: number
) {
  let min = Math.min(...valueArr);
  let max = Math.max(...valueArr);

  if (rangeMin !== undefined) {
    if (rangeMin < min) {
      min = rangeMin;
    }
  }
  if (rangeMax !== undefined) {
    if (rangeMax > max) {
      max = rangeMax;
    }
  }

  const normalized = valueArr.map((v) => {
    return 20 - ((v - min) / (max - min)) * 20;
  });

  const res = {
    line: GeneratePathLine(normalized),
    minLine: rangeMin
      ? GeneratePathLine(
          Array(normalized.length).fill(
            20 - ((rangeMin - min) / (max - min)) * 20
          )
        )
      : '',
    maxLine: rangeMax
      ? GeneratePathLine(
          Array(normalized.length).fill(
            20 - ((rangeMax - min) / (max - min)) * 20
          )
        )
      : '',
  };
  return res;
}

export function ShowDiagnosticReportResultsExpandable({
  item,
  docs,
  expanded,
  setExpanded,
  loading,
  id,
}: {
  item:
    | ClinicalDocument<BundleEntry<DiagnosticReport>>
    | ClinicalDocument<BundleEntry<Observation>>;
  docs: ClinicalDocument<BundleEntry<Observation>>[];
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  loading?: boolean;
  id?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expanded) {
          setExpanded(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded, setExpanded]);

  return (
    <MotionModal id={id}>
      <motion.div className="flex w-full flex-col p-4 pb-2">
        <MotionModalCategoryTitle id={id}>
          <p className="mr-1 w-12"></p>
        </MotionModalCategoryTitle>
        <motion.div className="flex justify-between">
          <MotionModalTitle id={id}>
            {item.metadata?.display_name
              ?.replace(/- final result/gi, '')
              .replace(/- final/gi, '')}
          </MotionModalTitle>
          <MotionModalCloseButton id={id} setExpanded={setExpanded} />
        </motion.div>
        <div className="flex flex-col">
          <MotionModalSubtitle id={id}>
            {format(parseISO(item.metadata?.date || ''), 'LLLL do yyyy')}
            <p className="text-sm font-light">
              {Array.isArray(item.data_record.raw.resource?.performer)
                ? item.data_record.raw.resource?.performer?.[0].display
                : item.data_record.raw.resource?.performer?.display}
            </p>
          </MotionModalSubtitle>
        </div>
      </motion.div>
      <MotionModalContent id={id}>
        {loading ? (
          <div className="max-h-full scroll-py-3 p-3">
            <div
              className={`${
                expanded ? '' : 'hidden'
              } rounded-lg border border-solid border-gray-200`}
            >
              <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
                <div className="col-span-3 text-sm font-semibold">Name</div>
                <div className="col-span-2 text-sm font-semibold">Value</div>
              </div>
              <div className="mx-4 grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-100 py-2">
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  Loading data
                </div>
                <div className="col-span-3 self-center text-xs font-semibold text-gray-600">
                  <ButtonLoadingSpinner height="h-3" width="w-3" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {docs.length > 0 ? (
              <div className="max-h-full scroll-py-3 p-3">
                <div
                  className={`${
                    expanded ? '' : 'hidden'
                  } rounded-lg border border-solid border-gray-200`}
                >
                  <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-700">
                    <div className="col-span-3 text-sm font-semibold">Name</div>
                    <div className="col-span-2 text-sm font-semibold">
                      Value
                    </div>
                  </div>
                  {docs.map((item) => (
                    <TableResultRowItem
                      item={item}
                      key={JSON.stringify(item)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-4 flex flex-col border-b-2 border-solid border-gray-100 py-2">
                <div className="self-center font-semibold text-gray-600">
                  No data available for this report
                </div>
              </div>
            )}
          </>
        )}
      </MotionModalContent>
    </MotionModal>
  );
}

export function getReferenceRangeString(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.text'
  )?.[0];
}

export function getReferenceRangeLow(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.low'
  )?.[0];
}

export function getReferenceRangeHigh(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'referenceRange.high'
  )?.[0];
}

export function getValueUnit(
  item: ClinicalDocument<BundleEntry<Observation>>
): string | undefined {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'valueQuantity.unit'
  )?.[0];
}

export function getValueQuantity(
  item: ClinicalDocument<BundleEntry<Observation>>
): number | undefined {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'valueQuantity.value'
  )?.[0];
}

export function getValueString(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'valueString')?.[0];
}

export function getComments(item: ClinicalDocument<BundleEntry<Observation>>) {
  return fhirpath.evaluate(item.data_record.raw.resource, 'comments')?.[0];
}

export function getInterpretationText(
  item: ClinicalDocument<BundleEntry<Observation>>
) {
  return fhirpath.evaluate(
    item.data_record.raw.resource,
    'interpretation.text'
  )?.[0];
}

/**
 * Takes a RxDocument of type ClinicalDocument<Observation> and returns true if the value is out of reference range
 * @param item
 */
export function isOutOfRangeResult(
  item: ClinicalDocument<BundleEntry<Observation>>
): boolean {
  const low = item.data_record.raw.resource?.referenceRange?.[0]?.low?.value;
  const high = item.data_record.raw.resource?.referenceRange?.[0]?.high?.value;
  const value = item.data_record.raw.resource?.valueQuantity?.value;

  if (low && high && value && !isNaN(low) && !isNaN(high) && !isNaN(value)) {
    return value < low || value > high;
  }
  return false;
}
