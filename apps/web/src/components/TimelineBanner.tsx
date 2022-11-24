import { person } from 'ionicons/icons';

export function TimelineBanner({
  image = person,
  text = 'Hello!',
  subtext = 'Your recent medical updates',
}: {
  image?: string;
  text?: string;
  subtext?: string;
}) {
  return (
    <div className="bg-primary flex items-stretch px-4 py-6 pt-6">
      <div className="flex flex-row items-stretch">
        <div className="flex h-full items-center justify-center pl-2 pr-4">
          <div className="aspect-square h-12 rounded-full border-2 border-solid border-white bg-gray-300">
            <img alt="profile" className="p-2" src={image}></img>
          </div>
        </div>
        <div className="flex-column  align-middle">
          <p className="text-2xl font-bold text-white">{text}</p>
          <p className="text-md text-white">{subtext}</p>
        </div>
      </div>
    </div>
  );
}
