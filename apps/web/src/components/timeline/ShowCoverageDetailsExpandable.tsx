import { BundleEntry as R4BundleEntry, Coverage } from 'fhir/r4';
import React from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { formatFullDate } from '../../utils/dateFormatters';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';

export function ShowCoverageDetailsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<R4BundleEntry<Coverage>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);
  const coverage = item.data_record.raw.resource;

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || 'Coverage Details'}
          subtitle={
            <div className="flex flex-col">
              {coverage?.period?.start && (
                <div className="text-sm font-light">
                  {formatFullDate(coverage.period.start)}
                  {coverage.period.end &&
                    ` - ${formatFullDate(coverage.period.end)}`}
                </div>
              )}
            </div>
          }
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div className="rounded-lg border border-solid border-gray-200 p-4">
            <div className="space-y-4">
              {coverage?.status && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Status
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 capitalize">
                    {coverage.status}
                  </div>
                </div>
              )}

              {coverage?.type?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Type
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {coverage.type.text}
                  </div>
                </div>
              )}

              {coverage?.subscriberId && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Subscriber ID
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {coverage.subscriberId}
                  </div>
                </div>
              )}

              {coverage?.payor && coverage.payor.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Payor
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {coverage.payor
                      .map((p) => p.display || p.reference)
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              )}

              {coverage?.period && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Coverage Period
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {formatFullDate(coverage.period.start)}
                    {coverage.period.end && (
                      <>
                        <br />
                        to {formatFullDate(coverage.period.end)}
                      </>
                    )}
                  </div>
                </div>
              )}

              {coverage?.relationship?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Relationship
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {coverage.relationship.text}
                  </div>
                </div>
              )}

              {coverage?.class && coverage.class.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Classification
                  </div>
                  <div className="col-span-2 space-y-1">
                    {coverage.class.map((c, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {c.type?.text && (
                          <span className="font-medium">{c.type.text}: </span>
                        )}
                        {c.value}
                        {c.name && ` (${c.name})`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coverage?.network && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Network
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {coverage.network}
                  </div>
                </div>
              )}

              {coverage?.order !== undefined && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Order
                  </div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {coverage.order}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
