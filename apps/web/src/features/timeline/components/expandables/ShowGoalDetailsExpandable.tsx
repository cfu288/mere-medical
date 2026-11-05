import { BundleEntry, Goal } from 'fhir/r4';
import React from 'react';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { formatFullDate } from '../../../../shared/utils/dateFormatters';
import { Modal } from '../../../../shared/components/Modal';
import { ModalHeader } from '../../../../shared/components/ModalHeader';

export function ShowGoalDetailsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<Goal>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);
  const goal = item.data_record.raw.resource;

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || 'Goal'}
          subtitle={
            <div className="flex flex-col">
              {goal?.startDate && (
                <div className="text-sm font-light">
                  Started: {formatFullDate(goal.startDate)}
                </div>
              )}
            </div>
          }
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div className="rounded-lg border border-solid border-gray-200 dark:border-gray-700 p-4">
            <div className="space-y-4">
              {goal?.lifecycleStatus && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100 capitalize">
                    {goal.lifecycleStatus.replace('-', ' ')}
                  </div>
                </div>
              )}

              {goal?.achievementStatus?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Achievement
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {goal.achievementStatus.text ||
                      goal.achievementStatus.coding?.[0]?.display}
                  </div>
                </div>
              )}

              {goal?.priority?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Priority
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {goal.priority.text || goal.priority.coding?.[0]?.display}
                  </div>
                </div>
              )}

              {goal?.description?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Description
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {goal.description.text}
                  </div>
                </div>
              )}

              {goal?.category && goal.category.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Category
                  </div>
                  <div className="col-span-2 space-y-1">
                    {goal.category.map((cat, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {cat.text || cat.coding?.[0]?.display || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {goal?.target && goal.target.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Target
                  </div>
                  <div className="col-span-2 space-y-2">
                    {goal.target.map((target, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100 border-l-2 border-emerald-300 dark:border-emerald-700 pl-2"
                      >
                        {target.measure?.text && (
                          <div>Measure: {target.measure.text}</div>
                        )}
                        {target.detailString && (
                          <div>Detail: {target.detailString}</div>
                        )}
                        {target.dueDate && (
                          <div className="text-gray-600 dark:text-gray-400">
                            Due: {formatFullDate(target.dueDate)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {goal?.statusDate && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status Date
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {formatFullDate(goal.statusDate)}
                  </div>
                </div>
              )}

              {goal?.statusReason && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status Reason
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {goal.statusReason}
                  </div>
                </div>
              )}

              {goal?.expressedBy?.display && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Expressed By
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {goal.expressedBy.display}
                  </div>
                </div>
              )}

              {goal?.note && goal.note.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Notes
                  </div>
                  <div className="col-span-2 space-y-1">
                    {goal.note.map((note, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {note.text}
                      </div>
                    ))}
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
