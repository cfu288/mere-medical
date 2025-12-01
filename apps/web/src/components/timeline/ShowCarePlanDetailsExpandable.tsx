import { format, parseISO } from 'date-fns';
import { BundleEntry, CarePlan } from 'fhir/r4';
import React from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';

export function ShowCarePlanDetailsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<CarePlan>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);
  const carePlan = item.data_record.raw.resource;

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    try {
      return format(parseISO(date), 'LLLL do yyyy');
    } catch {
      return date;
    }
  };

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || carePlan?.title || 'Care Plan'}
          subtitle={
            <div className="flex flex-col">
              {carePlan?.period?.start && (
                <div className="text-sm font-light">
                  {formatDate(carePlan.period.start)}
                  {carePlan.period.end && ` - ${formatDate(carePlan.period.end)}`}
                </div>
              )}
            </div>
          }
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div className="rounded-lg border border-solid border-gray-200 p-4">
            <div className="space-y-4">
              {carePlan?.status && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Status</div>
                  <div className="col-span-2 text-sm text-gray-900 capitalize">
                    {carePlan.status}
                  </div>
                </div>
              )}

              {carePlan?.intent && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Intent</div>
                  <div className="col-span-2 text-sm text-gray-900 capitalize">
                    {carePlan.intent}
                  </div>
                </div>
              )}

              {carePlan?.title && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Title</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {carePlan.title}
                  </div>
                </div>
              )}

              {carePlan?.description && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Description</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {carePlan.description}
                  </div>
                </div>
              )}

              {carePlan?.category && carePlan.category.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Category</div>
                  <div className="col-span-2 space-y-1">
                    {carePlan.category.map((cat, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {cat.text || cat.coding?.[0]?.display || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {carePlan?.activity && carePlan.activity.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Activities</div>
                  <div className="col-span-2 space-y-2">
                    {carePlan.activity.map((activity, index) => (
                      <div key={index} className="text-sm text-gray-900 border-l-2 border-indigo-300 pl-2">
                        {activity.detail?.description ||
                          activity.detail?.code?.text ||
                          activity.detail?.code?.coding?.[0]?.display ||
                          `Activity ${index + 1}`}
                        {activity.detail?.status && (
                          <span className="ml-2 text-gray-500 capitalize">
                            ({activity.detail.status})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {carePlan?.goal && carePlan.goal.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Goals</div>
                  <div className="col-span-2 space-y-1">
                    {carePlan.goal.map((goal, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {goal.display || goal.reference || `Goal ${index + 1}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {carePlan?.author?.display && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">Author</div>
                  <div className="col-span-2 text-sm text-gray-900">
                    {carePlan.author.display}
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
