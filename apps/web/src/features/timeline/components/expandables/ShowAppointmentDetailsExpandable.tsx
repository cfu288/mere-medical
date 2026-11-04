import { BundleEntry, Appointment } from 'fhir/r4';
import React from 'react';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { formatFullDateWithTime } from '../../../../shared/utils/dateFormatters';
import { Modal } from '../../../../shared/components/Modal';
import { ModalHeader } from '../../../../shared/components/ModalHeader';

export function ShowAppointmentDetailsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<Appointment>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);
  const appointment = item.data_record.raw.resource;

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || 'Appointment'}
          subtitle={
            <div className="flex flex-col">
              {appointment?.start && (
                <div className="text-sm font-light">
                  {formatFullDateWithTime(appointment.start)}
                </div>
              )}
            </div>
          }
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div className="rounded-lg border border-solid border-gray-200 dark:border-gray-700 p-4">
            <div className="space-y-4">
              {appointment?.status && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100 capitalize">
                    {appointment.status}
                  </div>
                </div>
              )}

              {appointment?.appointmentType?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Type
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {appointment.appointmentType.text ||
                      appointment.appointmentType.coding?.[0]?.display}
                  </div>
                </div>
              )}

              {appointment?.serviceType &&
                appointment.serviceType.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Service
                    </div>
                    <div className="col-span-2 space-y-1">
                      {appointment.serviceType.map((service, index) => (
                        <div
                          key={index}
                          className="text-sm text-gray-900 dark:text-gray-100"
                        >
                          {service.text ||
                            service.coding?.[0]?.display ||
                            'N/A'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {appointment?.description && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Description
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {appointment.description}
                  </div>
                </div>
              )}

              {appointment?.start && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Start
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {formatFullDateWithTime(appointment.start)}
                  </div>
                </div>
              )}

              {appointment?.end && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    End
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {formatFullDateWithTime(appointment.end)}
                  </div>
                </div>
              )}

              {appointment?.minutesDuration && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Duration
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {appointment.minutesDuration} minutes
                  </div>
                </div>
              )}

              {appointment?.participant &&
                appointment.participant.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Participants
                    </div>
                    <div className="col-span-2 space-y-2">
                      {appointment.participant.map((participant, index) => (
                        <div
                          key={index}
                          className="text-sm text-gray-900 dark:text-gray-100 border-l-2 border-violet-300 dark:border-violet-700 pl-2"
                        >
                          <div className="font-medium">
                            {participant.actor?.display ||
                              participant.actor?.reference ||
                              `Participant ${index + 1}`}
                          </div>
                          {participant.type && participant.type.length > 0 && (
                            <div className="text-gray-600 dark:text-gray-400">
                              {participant.type
                                .map((t) => t.text || t.coding?.[0]?.display)
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                          {participant.status && (
                            <div className="text-gray-500 dark:text-gray-400 text-xs capitalize">
                              {participant.status}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {appointment?.reasonCode && appointment.reasonCode.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Reason
                  </div>
                  <div className="col-span-2 space-y-1">
                    {appointment.reasonCode.map((reason, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {reason.text || reason.coding?.[0]?.display || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appointment?.comment && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Comment
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {appointment.comment}
                  </div>
                </div>
              )}

              {appointment?.patientInstruction && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Instructions
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {appointment.patientInstruction}
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
