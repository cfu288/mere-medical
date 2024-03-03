export function GenericBanner({
  text = '',
  uppercase = true,
}: {
  text?: string;
  uppercase?: boolean;
}) {
  return (
    <div className="bg-primary flex items-stretch px-4 py-6 pt-6 ">
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
