import { isElectron } from '../utils/isElectron';

export function GenericBanner({
  text = '',
  uppercase = true,
}: {
  text?: string;
  uppercase?: boolean;
}) {
  return (
    <div className={`bg-primary flex flex-col items-stretch px-4 pb-6`}>
      <div
        className={`h-6 w-full ${isElectron() ? 'active:bg-primary-700 z-20 rounded-full' : ''}`}
        alt="drag handle"
        style={{
          // @ts-ignore
          WebkitAppRegion: isElectron() ? 'drag' : 'no-drag',
        }}
      />
      <div className="flex flex-row items-stretch">
        <div className="flex-column align-middle">
          <p
            className={`text-xl font-black ${
              uppercase ? 'uppercase' : ''
            } text-white`}
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
