import {
  checkIfDefaultDate,
  formattedTitleDateMonthString,
  formattedTitleDateDayString,
} from '../../pages/TimelineTab';

interface TimelineMonthDayHeaderProps {
  dateKey: string;
}

export const TimelineMonthDayHeader: React.FC<TimelineMonthDayHeaderProps> = ({
  dateKey,
}) => {
  return (
    <div
      className={`sticky top-16 z-0 flex flex-col bg-transparent mt-4 mb-2 h-10 ${
        checkIfDefaultDate(dateKey) ? 'opacity-0' : ''
      }`}
    >
      <div className="flex flex-row py-1">
        <div className="relative flex flex-col">
          <div className="h-0 mt-0 bg-transparent">
            <div className="px-3 bg-gray-50 border-2 md:border-4 border-gray-200 rounded-full aspect-square flex flex-col justify-center">
              <p className="text-sm font-black text-center">
                {checkIfDefaultDate(dateKey) ? null : (
                  <p className="font-bold">{`${formattedTitleDateMonthString(dateKey)}`}</p>
                )}
              </p>
              <p className="text-center text-sm leading-none">
                {checkIfDefaultDate(dateKey)
                  ? ''
                  : `${formattedTitleDateDayString(dateKey)}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
