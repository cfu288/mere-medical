import { BundleEntry, CareTeam } from 'fhir/r4';
import React from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { formatFullDate } from '../../utils/dateFormatters';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';

export function ShowCareTeamDetailsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<CareTeam>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const toggleOpen = () => setExpanded((x) => !x);
  const careTeam = item.data_record.raw.resource;

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || careTeam?.name || 'Care Team'}
          subtitle={
            <div className="flex flex-col">
              {careTeam?.period?.start && (
                <div className="text-sm font-light">
                  {formatFullDate(careTeam.period.start)}
                  {careTeam.period.end &&
                    ` - ${formatFullDate(careTeam.period.end)}`}
                </div>
              )}
            </div>
          }
          setClose={toggleOpen}
        />
        <div className="max-h-full scroll-py-3 p-3">
          <div className="rounded-lg border border-solid border-gray-200 p-4">
            <div className="space-y-4">
              {careTeam?.status && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Status
                  </div>
                  <div className="col-span-2 text-sm text-gray-900 capitalize">
                    {careTeam.status}
                  </div>
                </div>
              )}

              {careTeam?.category && careTeam.category.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Category
                  </div>
                  <div className="col-span-2 space-y-1">
                    {careTeam.category.map((cat, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {cat.text || cat.coding?.[0]?.display || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {careTeam?.participant && careTeam.participant.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Participants
                  </div>
                  <div className="col-span-2 space-y-2">
                    {careTeam.participant.map((participant, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-900 border-l-2 border-cyan-300 pl-2"
                      >
                        <div className="font-medium">
                          {participant.member?.display ||
                            participant.member?.reference ||
                            `Participant ${index + 1}`}
                        </div>
                        {participant.role && participant.role.length > 0 && (
                          <div className="text-gray-600">
                            Role:{' '}
                            {participant.role
                              .map((r) => r.text || r.coding?.[0]?.display)
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                        {participant.period && (
                          <div className="text-gray-500 text-xs">
                            {formatFullDate(participant.period.start)}
                            {participant.period.end &&
                              ` - ${formatFullDate(participant.period.end)}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {careTeam?.reasonCode && careTeam.reasonCode.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Reason
                  </div>
                  <div className="col-span-2 space-y-1">
                    {careTeam.reasonCode.map((reason, index) => (
                      <div key={index} className="text-sm text-gray-900">
                        {reason.text || reason.coding?.[0]?.display || 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {careTeam?.managingOrganization &&
                careTeam.managingOrganization.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-sm font-semibold text-gray-700">
                      Organization
                    </div>
                    <div className="col-span-2 space-y-1">
                      {careTeam.managingOrganization.map((org, index) => (
                        <div key={index} className="text-sm text-gray-900">
                          {org.display || org.reference || 'N/A'}
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
