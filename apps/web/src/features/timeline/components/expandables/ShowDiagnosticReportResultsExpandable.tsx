/* eslint-disable react/jsx-no-useless-fragment */
import { BundleEntry, DiagnosticReport, Observation } from 'fhir/r2';
import React from 'react';

import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { formatFullDate } from '../../../../shared/utils/dateFormatters';
import { getDiagnosticReportPerformer } from '../../../../shared/utils/fhirAccessHelpers';
import { ButtonLoadingSpinner } from '../../../connections/components/ButtonLoadingSpinner';
import { Modal } from '../../../../shared/components/Modal';
import { ModalHeader } from '../../../../shared/components/ModalHeader';
import { ObservationResultRow } from '../ObservationResultRow';

export function ShowDiagnosticReportResultsExpandable({
  item,
  docs,
  expanded,
  setExpanded,
  loading,
}: {
  item:
    | ClinicalDocument<BundleEntry<DiagnosticReport>>
    | ClinicalDocument<BundleEntry<Observation>>;
  docs: ClinicalDocument<BundleEntry<Observation>>[];
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  loading?: boolean;
}) {
  const toggleOpen = () => setExpanded((x) => !x);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          subtitle={
            <div className="flex flex-col">
              <div className="text-sm font-light">
                {formatFullDate(item.metadata?.date)}
              </div>
              <div className="text-sm font-light">
                {getDiagnosticReportPerformer(item)}
              </div>
            </div>
          }
          setClose={toggleOpen}
        />
        {loading ? (
          <div className="max-h-full scroll-py-3 p-3">
            <div
              className={`${
                expanded ? '' : 'hidden'
              } rounded-lg border border-solid border-gray-200`}
            >
              <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-800">
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
                  <div className="grid grid-cols-6 gap-2 gap-y-2 border-b-2 border-solid border-gray-200 p-2 px-4 text-gray-800">
                    <div className="col-span-3 text-sm font-semibold">Name</div>
                    <div className="col-span-2 text-sm font-semibold">
                      Value
                    </div>
                  </div>
                  {docs.map((item) => (
                    <ObservationResultRow
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
      </div>
    </Modal>
  );
}
