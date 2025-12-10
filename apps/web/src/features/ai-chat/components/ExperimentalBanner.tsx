import grainImage from '../../../assets/img/grain.svg';

export function ExperimentalBanner() {
  return (
    <div
      style={{
        background: 'rgb(199 210 254 / 0.4)',
        // @ts-ignore
        '--image-url': `url(${grainImage})`,
        // @ts-ignore
        '-webkit-backdrop-filter': 'blur(10px)',
        backdropFilter: 'blur(10px)',
      }}
      className={`absolute top-0 left-0 bg-[backdrop-filter:var(--tw-backdrop-blur)] w-full text-indigo-700 text-xs sm:text-sm font-bold p-1 px-2 bg-opacity-40 text-center`}
    >
      Experimental
    </div>
  );
}
