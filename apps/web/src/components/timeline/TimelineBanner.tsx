export function TimelineBanner({
  image,
  text = 'Hello!',
  subtext = 'Your recent medical updates',
}: {
  image?: string;
  text?: string;
  subtext?: string;
}) {
  return (
    <div className="bg-primary flex items-stretch px-4 py-3 sm:py-4">
      <div className="flex flex-row items-stretch">
        <div className="flex h-full items-center justify-center pl-2 pr-4">
          <div className="aspect-square h-12 rounded-full border-2 border-solid border-white bg-gray-100 md:hidden">
            {image ? (
              <img
                alt="profile"
                className="h-full w-full rounded-full"
                src={image}
              ></img>
            ) : (
              <svg
                className="h-full w-full rounded-full text-gray-700"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex-column align-middle">
          <p className="text-xl font-bold text-white sm:text-2xl">{text}</p>
          <p className="text-md text-white">{subtext}</p>
        </div>
      </div>
    </div>
  );
}
