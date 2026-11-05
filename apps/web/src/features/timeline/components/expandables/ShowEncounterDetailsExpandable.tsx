import { BundleEntry, Encounter } from 'fhir/r2';
import {
  BundleEntry as R4BundleEntry,
  Encounter as R4Encounter,
} from 'fhir/r4';
import React, { useMemo } from 'react';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';
import { formatFullDateWithTime } from '../../../../shared/utils/dateFormatters';
import {
  getEncounterClass,
  getEncounterLocation,
  getEncounterPatient,
  getEncounterIndication,
} from '../../../../shared/utils/fhirAccessHelpers';
import { Modal } from '../../../../shared/components/Modal';
import { ModalHeader } from '../../../../shared/components/ModalHeader';

export function ShowEncounterDetailsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<Encounter> | R4BundleEntry<R4Encounter>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);
  const encounter = item.data_record.raw.resource;
  const isR4 = item.data_record.format === 'FHIR.R4';
  const r4Encounter = isR4 ? (encounter as R4Encounter) : null;
  const dstu2Encounter = !isR4 ? (encounter as Encounter) : null;

  const getEncounterClassDisplay = () => {
    if (isR4 && r4Encounter) {
      return r4Encounter.class?.display || r4Encounter.class?.code;
    }
    return dstu2Encounter?.class;
  };

  const getReasonCodes = () => {
    if (isR4 && r4Encounter?.reasonCode) {
      return r4Encounter.reasonCode.map(
        (r) => r.text || r.coding?.[0]?.display || 'N/A',
      );
    }
    if (dstu2Encounter?.reason) {
      return dstu2Encounter.reason.map(
        (r) => r.text || r.coding?.[0]?.display || 'N/A',
      );
    }
    return [];
  };

  const uniqueParticipants = useMemo(() => {
    if (!encounter?.participant) return [];
    const seen = new Set<string>();
    return encounter.participant.filter((p) => {
      const key = p.individual?.display || p.individual?.reference || '';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [encounter?.participant]);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={`${getEncounterClass(item)} - ${getEncounterLocation(item)}`}
          subtitle={
            <div className="flex flex-col">
              {encounter?.period?.start && (
                <div className="text-sm font-light">
                  {formatFullDateWithTime(encounter.period.start)}
                  {encounter.period.end &&
                    ` - ${formatFullDateWithTime(encounter.period.end)}`}
                </div>
              )}
            </div>
          }
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div className="rounded-lg border border-solid border-gray-200 dark:border-gray-700 p-4">
            <div className="space-y-4">
              {encounter?.status && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100 capitalize">
                    {encounter.status}
                  </div>
                </div>
              )}

              {getEncounterClassDisplay() && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Class
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100 capitalize">
                    {getEncounterClassDisplay()}
                  </div>
                </div>
              )}

              {encounter?.type && encounter.type.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Type
                  </div>
                  <div className="col-span-2 space-y-1">
                    {encounter.type.map((type, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {type.text || type.coding?.[0]?.display || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {encounter?.priority?.text && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Priority
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {encounter.priority.text}
                  </div>
                </div>
              )}

              {getEncounterPatient(item) && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Patient
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {getEncounterPatient(item)}
                  </div>
                </div>
              )}

              {uniqueParticipants.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Participants
                  </div>
                  <div className="col-span-2 space-y-1">
                    {uniqueParticipants.map((p, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {p.individual?.display ||
                          p.individual?.reference ||
                          'Unknown'}
                        {p.type && p.type.length > 0 && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {' '}
                            ({p.type[0].text || p.type[0].coding?.[0]?.display})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {encounter?.period && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Time Period
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {formatFullDateWithTime(encounter.period.start)}
                    {encounter.period.end && (
                      <>
                        <br />
                        to {formatFullDateWithTime(encounter.period.end)}
                      </>
                    )}
                  </div>
                </div>
              )}

              {encounter?.length?.value !== undefined && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Length
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {encounter.length.value}{' '}
                    {encounter.length.unit || 'minutes'}
                  </div>
                </div>
              )}

              {getReasonCodes().length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Reason
                  </div>
                  <div className="col-span-2 space-y-1">
                    {getReasonCodes().map((reason, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getEncounterIndication(item).length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Indication
                  </div>
                  <div className="col-span-2 space-y-1">
                    {getEncounterIndication(item).map((indication, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {indication.display || indication.reference || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {encounter?.hospitalization && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Hospitalization
                  </div>
                  <div className="col-span-2 space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    {encounter.hospitalization.admitSource?.text && (
                      <div>
                        <span className="font-medium">Admit Source: </span>
                        {encounter.hospitalization.admitSource.text}
                      </div>
                    )}
                    {encounter.hospitalization.dischargeDisposition?.text && (
                      <div>
                        <span className="font-medium">
                          Discharge Disposition:{' '}
                        </span>
                        {encounter.hospitalization.dischargeDisposition.text}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {encounter?.location && encounter.location.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Location(s)
                  </div>
                  <div className="col-span-2 space-y-1">
                    {encounter.location.map((loc, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 dark:text-gray-100"
                      >
                        {loc.location?.display ||
                          loc.location?.reference ||
                          'N/A'}
                        {loc.status && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {' '}
                            ({loc.status})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {encounter?.serviceProvider?.display && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Service Provider
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 dark:text-gray-100">
                    {encounter.serviceProvider.display}
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
